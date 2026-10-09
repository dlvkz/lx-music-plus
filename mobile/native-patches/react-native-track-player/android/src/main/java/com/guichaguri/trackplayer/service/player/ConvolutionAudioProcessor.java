package com.guichaguri.trackplayer.service.player;

import android.content.res.AssetManager;
import android.util.Log;

import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Ambient reverb: the sound is convolved with an impulse response (a recording of a room), like the
 * ConvolverNode of the desktop app (same impulse files, same normalization, original + effect gains
 * followed by a compressor). Uniformly partitioned FFT convolution, done in blocks of BLOCK frames.
 */
public final class ConvolutionAudioProcessor extends BaseAudioProcessor {
    private static final String TAG = "LxConvolution";
    private static final int BLOCK = 2048;
    private static final int FFT_SIZE = BLOCK * 2;
    private static final int BINS = BLOCK + 1;

    /** one processor for the app: the settings survive the creation of a new player */
    public static final ConvolutionAudioProcessor INSTANCE = new ConvolutionAudioProcessor();

    private static final class Impulse {
        final String name;
        final int sampleRate;
        final float[][] channels;

        Impulse(String name, int sampleRate, float[][] channels) {
            this.name = name;
            this.sampleRate = sampleRate;
            this.channels = channels;
        }
    }

    /** the impulse ready to be used at a sample rate: its partitions in the frequency domain, and the buffers */
    private static final class Kernel {
        final Impulse impulse;
        final int sampleRate;
        final int partitions;
        final float[][][] hRe;
        final float[][][] hIm;
        // spectrum history of the input blocks, by input channel
        final float[][][] xRe;
        final float[][][] xIm;

        Kernel(Impulse impulse, int sampleRate, int partitions, float[][][] hRe, float[][][] hIm) {
            this.impulse = impulse;
            this.sampleRate = sampleRate;
            this.partitions = partitions;
            this.hRe = hRe;
            this.hIm = hIm;
            this.xRe = new float[2][partitions][BINS];
            this.xIm = new float[2][partitions][BINS];
        }
    }

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile Impulse impulse;
    private volatile Kernel readyKernel;
    private volatile float mainGain = 1f;
    private volatile float sendGain = 0f;
    private volatile int streamSampleRate = 0;

    // audio thread
    private Kernel kernel;
    private final float[][] inBlock = new float[2][BLOCK];
    private int fill = 0;
    private int position = 0;
    private final float[][] overlap = new float[2][BLOCK];
    private final float[][] wet = new float[2][BLOCK];
    private final float[] re = new float[FFT_SIZE];
    private final float[] im = new float[FFT_SIZE];
    private final float[] accRe = new float[BINS];
    private final float[] accIm = new float[BINS];
    private float compressorGainDb = 0f;

    private ConvolutionAudioProcessor() {}

    /* ---------- settings ---------- */

    /**
     * Set the impulse (a wav file of the assets), null or empty to turn the effect off
     * @param mainGain gain of the original sound
     * @param sendGain gain of the effect
     */
    public void setConvolution(AssetManager assets, String fileName, float mainGain, float sendGain) {
        this.mainGain = mainGain;
        this.sendGain = sendGain;
        if (fileName == null || fileName.isEmpty()) {
            impulse = null;
            readyKernel = null;
            return;
        }
        Impulse current = impulse;
        if (current != null && current.name.equals(fileName)) return;
        executor.execute(() -> {
            try {
                Impulse loaded = loadImpulse(assets, fileName);
                impulse = loaded;
                buildKernel(loaded, streamSampleRate);
            } catch (Exception e) {
                Log.e(TAG, "load impulse failed: " + fileName, e);
            }
        });
    }

    public void setGains(float mainGain, float sendGain) {
        this.mainGain = mainGain;
        this.sendGain = sendGain;
    }

    public boolean isEnabled() {
        return impulse != null;
    }

    private void requestKernel(int sampleRate) {
        Impulse current = impulse;
        Kernel ready = readyKernel;
        if (current == null || (ready != null && ready.impulse == current && ready.sampleRate == sampleRate)) return;
        executor.execute(() -> buildKernel(current, sampleRate));
    }

    private void buildKernel(Impulse source, int sampleRate) {
        if (source == null || sampleRate <= 0) return;
        Kernel ready = readyKernel;
        if (ready != null && ready.impulse == source && ready.sampleRate == sampleRate) return;
        float[][] channels = resample(source.channels, source.sampleRate, sampleRate);
        int length = channels[0].length;
        int partitions = Math.max(1, (length + BLOCK - 1) / BLOCK);
        float[][][] hRe = new float[channels.length][partitions][BINS];
        float[][][] hIm = new float[channels.length][partitions][BINS];
        float[] r = new float[FFT_SIZE];
        float[] i = new float[FFT_SIZE];
        for (int c = 0; c < channels.length; c++) {
            for (int p = 0; p < partitions; p++) {
                Arrays.fill(r, 0f);
                Arrays.fill(i, 0f);
                int start = p * BLOCK;
                int end = Math.min(start + BLOCK, length);
                if (end > start) System.arraycopy(channels[c], start, r, 0, end - start);
                fft(r, i, false);
                System.arraycopy(r, 0, hRe[c][p], 0, BINS);
                System.arraycopy(i, 0, hIm[c][p], 0, BINS);
            }
        }
        // changed meanwhile
        if (impulse != source) return;
        readyKernel = new Kernel(source, sampleRate, partitions, hRe, hIm);
    }

    /* ---------- AudioProcessor ---------- */

    @Override
    protected AudioFormat onConfigure(AudioFormat inputAudioFormat) throws UnhandledAudioFormatException {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT || inputAudioFormat.channelCount < 1 || inputAudioFormat.channelCount > 2) {
            return AudioFormat.NOT_SET;
        }
        streamSampleRate = inputAudioFormat.sampleRate;
        requestKernel(inputAudioFormat.sampleRate);
        return inputAudioFormat;
    }

    @Override
    public void queueInput(ByteBuffer inputBuffer) {
        int channels = inputAudioFormat.channelCount;
        int frames = inputBuffer.remaining() / inputAudioFormat.bytesPerFrame;
        if (frames == 0) return;
        inputBuffer.order(ByteOrder.nativeOrder());

        Kernel next = readyKernel;
        if (next != null && (next.sampleRate != inputAudioFormat.sampleRate || next.impulse != impulse)) {
            requestKernel(inputAudioFormat.sampleRate);
            next = null;
        }
        if (next != kernel) {
            // the effect is switched: what is waiting in the block goes out without the effect
            int pending = kernel == null ? 0 : fill;
            ByteBuffer out = replaceOutputBuffer((pending + (next == null ? frames : 0)) * inputAudioFormat.bytesPerFrame).order(ByteOrder.nativeOrder());
            for (int f = 0; f < pending; f++) {
                for (int c = 0; c < channels; c++) out.putShort(toShort(inBlock[c][f]));
            }
            kernel = next;
            resetState();
            if (next == null) {
                while (inputBuffer.hasRemaining()) out.putShort(inputBuffer.getShort());
                out.flip();
                return;
            }
            if (pending > 0) {
                // the input is processed in a second output buffer: keep it simple, the rest waits for the next call
                out.flip();
                return;
            }
        }
        if (kernel == null) {
            ByteBuffer out = replaceOutputBuffer(inputBuffer.remaining()).order(ByteOrder.nativeOrder());
            out.put(inputBuffer);
            out.flip();
            return;
        }

        int blocks = (fill + frames) / BLOCK;
        ByteBuffer out = replaceOutputBuffer(blocks * BLOCK * inputAudioFormat.bytesPerFrame).order(ByteOrder.nativeOrder());
        while (inputBuffer.hasRemaining()) {
            for (int c = 0; c < channels; c++) inBlock[c][fill] = inputBuffer.getShort() / 32768f;
            fill++;
            if (fill == BLOCK) {
                processBlock(channels);
                writeBlock(out, channels, BLOCK);
                fill = 0;
            }
        }
        out.flip();
    }

    @Override
    protected void onQueueEndOfStream() {
        if (kernel == null || fill == 0) return;
        int channels = inputAudioFormat.channelCount;
        int frames = fill;
        for (int c = 0; c < channels; c++) Arrays.fill(inBlock[c], frames, BLOCK, 0f);
        processBlock(channels);
        ByteBuffer out = replaceOutputBuffer(frames * inputAudioFormat.bytesPerFrame).order(ByteOrder.nativeOrder());
        writeBlock(out, channels, frames);
        out.flip();
        fill = 0;
    }

    @Override
    protected void onFlush() {
        resetState();
    }

    @Override
    protected void onReset() {
        kernel = null;
        resetState();
    }

    private void resetState() {
        fill = 0;
        position = 0;
        compressorGainDb = 0f;
        for (int c = 0; c < 2; c++) {
            Arrays.fill(overlap[c], 0f);
            Arrays.fill(inBlock[c], 0f);
        }
        Kernel k = kernel;
        if (k != null) {
            for (int c = 0; c < 2; c++) {
                for (int p = 0; p < k.partitions; p++) {
                    Arrays.fill(k.xRe[c][p], 0f);
                    Arrays.fill(k.xIm[c][p], 0f);
                }
            }
        }
    }

    /* ---------- convolution ---------- */

    private void processBlock(int channels) {
        Kernel k = kernel;
        int partitions = k.partitions;
        // spectrum of the new block of each input channel
        for (int c = 0; c < channels; c++) {
            System.arraycopy(inBlock[c], 0, re, 0, BLOCK);
            Arrays.fill(re, BLOCK, FFT_SIZE, 0f);
            Arrays.fill(im, 0f);
            fft(re, im, false);
            System.arraycopy(re, 0, k.xRe[c][position], 0, BINS);
            System.arraycopy(im, 0, k.xIm[c][position], 0, BINS);
        }
        int irChannels = k.hRe.length;
        for (int o = 0; o < channels; o++) {
            Arrays.fill(accRe, 0f);
            Arrays.fill(accIm, 0f);
            if (channels == 1) {
                accumulate(k, 0, 0);
            } else if (irChannels == 4) {
                // true stereo: L = inL * ir0 + inR * ir2, R = inL * ir1 + inR * ir3
                if (o == 0) {
                    accumulate(k, 0, 0);
                    accumulate(k, 1, 2);
                } else {
                    accumulate(k, 0, 1);
                    accumulate(k, 1, 3);
                }
            } else {
                accumulate(k, o, Math.min(o, irChannels - 1));
            }
            // back to the time domain (the spectrum of a real signal is symmetric)
            for (int b = 0; b < BINS; b++) {
                re[b] = accRe[b];
                im[b] = accIm[b];
            }
            for (int b = BINS; b < FFT_SIZE; b++) {
                re[b] = accRe[FFT_SIZE - b];
                im[b] = -accIm[FFT_SIZE - b];
            }
            fft(re, im, true);
            float[] w = wet[o];
            float[] ov = overlap[o];
            for (int f = 0; f < BLOCK; f++) {
                w[f] = re[f] + ov[f];
                ov[f] = re[f + BLOCK];
            }
        }
        position = (position + 1) % partitions;
    }

    private void accumulate(Kernel k, int inChannel, int irChannel) {
        int partitions = k.partitions;
        float[][] xr = k.xRe[inChannel];
        float[][] xi = k.xIm[inChannel];
        float[][] hr = k.hRe[irChannel];
        float[][] hi = k.hIm[irChannel];
        for (int p = 0; p < partitions; p++) {
            int index = position - p;
            if (index < 0) index += partitions;
            float[] ar = xr[index];
            float[] ai = xi[index];
            float[] br = hr[p];
            float[] bi = hi[p];
            for (int b = 0; b < BINS; b++) {
                float a = ar[b];
                float c = ai[b];
                float d = br[b];
                float e = bi[b];
                accRe[b] += a * d - c * e;
                accIm[b] += a * e + c * d;
            }
        }
    }

    // compressor of the desktop chain (Web Audio DynamicsCompressorNode defaults)
    private static final float THRESHOLD = -24f;
    private static final float KNEE = 30f;
    private static final float RATIO = 12f;
    private static final float MAKEUP_DB = 13.2f;

    private void writeBlock(ByteBuffer out, int channels, int frames) {
        float main = mainGain;
        float send = sendGain;
        int rate = Math.max(1, inputAudioFormat.sampleRate);
        float attack = (float) Math.exp(-1.0 / (0.003 * rate));
        float release = (float) Math.exp(-1.0 / (0.25 * rate));
        float[] sample = new float[2];
        for (int f = 0; f < frames; f++) {
            float level = 0f;
            for (int c = 0; c < channels; c++) {
                float v = inBlock[c][f] * main + wet[c][f] * send;
                sample[c] = v;
                level = Math.max(level, Math.abs(v));
            }
            float xDb = level > 1e-6f ? (float) (20 * Math.log10(level)) : -120f;
            float yDb;
            float over = xDb - THRESHOLD;
            if (2 * over < -KNEE) yDb = xDb;
            else if (2 * Math.abs(over) <= KNEE) yDb = xDb + (1f / RATIO - 1f) * (over + KNEE / 2) * (over + KNEE / 2) / (2 * KNEE);
            else yDb = THRESHOLD + over / RATIO;
            float targetDb = yDb - xDb;
            compressorGainDb = targetDb < compressorGainDb
                ? attack * compressorGainDb + (1 - attack) * targetDb
                : release * compressorGainDb + (1 - release) * targetDb;
            float gain = (float) Math.pow(10, (compressorGainDb + MAKEUP_DB) / 20);
            for (int c = 0; c < channels; c++) out.putShort(toShort(sample[c] * gain));
        }
    }

    private static short toShort(float value) {
        float v = value * 32768f;
        if (v > 32767f) v = 32767f;
        else if (v < -32768f) v = -32768f;
        return (short) v;
    }

    /* ---------- fft (radix 2, in place) ---------- */

    private static final float[] COS = new float[FFT_SIZE / 2];
    private static final float[] SIN = new float[FFT_SIZE / 2];
    private static final int[] REVERSE = new int[FFT_SIZE];
    static {
        for (int i = 0; i < FFT_SIZE / 2; i++) {
            COS[i] = (float) Math.cos(2 * Math.PI * i / FFT_SIZE);
            SIN[i] = (float) Math.sin(2 * Math.PI * i / FFT_SIZE);
        }
        int bits = Integer.numberOfTrailingZeros(FFT_SIZE);
        for (int i = 0; i < FFT_SIZE; i++) REVERSE[i] = Integer.reverse(i) >>> (32 - bits);
    }

    private static void fft(float[] re, float[] im, boolean inverse) {
        int n = FFT_SIZE;
        for (int i = 0; i < n; i++) {
            int j = REVERSE[i];
            if (j > i) {
                float t = re[i]; re[i] = re[j]; re[j] = t;
                t = im[i]; im[i] = im[j]; im[j] = t;
            }
        }
        for (int size = 2; size <= n; size <<= 1) {
            int half = size >> 1;
            int step = n / size;
            for (int start = 0; start < n; start += size) {
                for (int k = 0; k < half; k++) {
                    float cos = COS[k * step];
                    float sin = inverse ? SIN[k * step] : -SIN[k * step];
                    int a = start + k;
                    int b = a + half;
                    float tr = re[b] * cos - im[b] * sin;
                    float ti = re[b] * sin + im[b] * cos;
                    re[b] = re[a] - tr;
                    im[b] = im[a] - ti;
                    re[a] += tr;
                    im[a] += ti;
                }
            }
        }
        if (inverse) {
            float scale = 1f / n;
            for (int i = 0; i < n; i++) {
                re[i] *= scale;
                im[i] *= scale;
            }
        }
    }

    /* ---------- impulse files ---------- */

    private static Impulse loadImpulse(AssetManager assets, String fileName) throws IOException {
        byte[] data;
        try (InputStream stream = assets.open("filters/" + fileName)) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int read;
            while ((read = stream.read(chunk)) != -1) buffer.write(chunk, 0, read);
            data = buffer.toByteArray();
        }
        ByteBuffer wav = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
        if (data.length < 12 || wav.getInt(0) != 0x46464952 || wav.getInt(8) != 0x45564157) throw new IOException("not a wav file");
        int format = 0;
        int channels = 0;
        int sampleRate = 0;
        int bits = 0;
        int dataStart = -1;
        int dataLength = 0;
        int offset = 12;
        while (offset + 8 <= data.length) {
            int id = wav.getInt(offset);
            int size = wav.getInt(offset + 4);
            int body = offset + 8;
            if (id == 0x20746d66) { // "fmt "
                format = wav.getShort(body) & 0xffff;
                channels = wav.getShort(body + 2);
                sampleRate = wav.getInt(body + 4);
                bits = wav.getShort(body + 14);
                if (format == 0xfffe && size >= 26) format = wav.getShort(body + 24) & 0xffff;
            } else if (id == 0x61746164) { // "data"
                dataStart = body;
                dataLength = Math.min(size, data.length - body);
                break;
            }
            offset = body + size + (size & 1);
        }
        if (dataStart < 0 || channels <= 0 || sampleRate <= 0) throw new IOException("bad wav file");
        int bytesPerSample = bits / 8;
        int frames = dataLength / (bytesPerSample * channels);
        float[][] samples = new float[channels][frames];
        for (int f = 0; f < frames; f++) {
            for (int c = 0; c < channels; c++) {
                int pos = dataStart + (f * channels + c) * bytesPerSample;
                float v;
                if (format == 3 && bits == 32) v = wav.getFloat(pos);
                else if (bits == 16) v = wav.getShort(pos) / 32768f;
                else if (bits == 24) v = ((data[pos] & 0xff) | ((data[pos + 1] & 0xff) << 8) | (data[pos + 2] << 16)) / 8388608f;
                else if (bits == 32) v = wav.getInt(pos) / 2147483648f;
                else v = ((data[pos] & 0xff) - 128) / 128f;
                samples[c][f] = v;
            }
        }
        // normalization of the Web Audio ConvolverNode
        double power = 0;
        for (float[] channel : samples) for (float v : channel) power += v * v;
        power = Math.sqrt(power / ((double) channels * frames));
        if (Double.isNaN(power) || Double.isInfinite(power) || power < 0.000125) power = 0.000125;
        double scale = 1 / power * 0.00125 * (44100.0 / sampleRate);
        if (channels == 4) scale *= 0.5;
        for (float[] channel : samples) for (int i = 0; i < channel.length; i++) channel[i] *= (float) scale;
        return new Impulse(fileName, sampleRate, samples);
    }

    private static float[][] resample(float[][] channels, int from, int to) {
        if (from == to) return channels;
        int length = (int) ((long) channels[0].length * to / from);
        float[][] result = new float[channels.length][length];
        double ratio = (double) from / to;
        for (int c = 0; c < channels.length; c++) {
            float[] src = channels[c];
            float[] dst = result[c];
            for (int i = 0; i < length; i++) {
                double pos = i * ratio;
                int index = (int) pos;
                float frac = (float) (pos - index);
                float a = src[Math.min(index, src.length - 1)];
                float b = src[Math.min(index + 1, src.length - 1)];
                dst[i] = a + (b - a) * frac;
            }
        }
        return result;
    }
}
