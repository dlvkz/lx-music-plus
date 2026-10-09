package com.guichaguri.trackplayer.service.player;

import androidx.media3.common.C;
import androidx.media3.common.audio.BaseAudioProcessor;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Equalizer of the desktop app: 10 peaking filters (Web Audio BiquadFilterNode, Q 1.4), -15 to 15 dB
 */
public final class EqualizerAudioProcessor extends BaseAudioProcessor {
    public static final int[] FREQS = { 31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 };
    private static final double Q = 1.4;

    public static final EqualizerAudioProcessor INSTANCE = new EqualizerAudioProcessor();

    private volatile float[] gains = new float[FREQS.length];
    private volatile boolean changed = true;

    // audio thread
    private float[] appliedGains = new float[FREQS.length];
    private int appliedRate = 0;
    private final double[][] coef = new double[FREQS.length][5];
    private final boolean[] bandOn = new boolean[FREQS.length];
    // filter state: [band][channel][x1, x2, y1, y2]
    private final double[][][] state = new double[FREQS.length][2][4];

    private EqualizerAudioProcessor() {}

    public void setGains(float[] values) {
        float[] next = new float[FREQS.length];
        for (int i = 0; i < FREQS.length && i < values.length; i++) next[i] = Math.max(-15f, Math.min(15f, values[i]));
        gains = next;
        changed = true;
    }

    public boolean isEnabled() {
        for (float g : gains) if (g != 0) return true;
        return false;
    }

    @Override
    protected AudioFormat onConfigure(AudioFormat inputAudioFormat) throws UnhandledAudioFormatException {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT || inputAudioFormat.channelCount < 1 || inputAudioFormat.channelCount > 2) {
            return AudioFormat.NOT_SET;
        }
        changed = true;
        return inputAudioFormat;
    }

    private void updateCoefficients(int rate) {
        appliedGains = gains;
        appliedRate = rate;
        for (int b = 0; b < FREQS.length; b++) {
            float gain = appliedGains[b];
            bandOn[b] = gain != 0 && FREQS[b] < rate / 2;
            if (!bandOn[b]) continue;
            double a = Math.pow(10, gain / 40.0);
            double w0 = 2 * Math.PI * FREQS[b] / rate;
            double alpha = Math.sin(w0) / (2 * Q);
            double cos = Math.cos(w0);
            double a0 = 1 + alpha / a;
            coef[b][0] = (1 + alpha * a) / a0;
            coef[b][1] = -2 * cos / a0;
            coef[b][2] = (1 - alpha * a) / a0;
            coef[b][3] = -2 * cos / a0;
            coef[b][4] = (1 - alpha / a) / a0;
        }
    }

    @Override
    public void queueInput(ByteBuffer inputBuffer) {
        int size = inputBuffer.remaining();
        if (size == 0) return;
        inputBuffer.order(ByteOrder.nativeOrder());
        ByteBuffer out = replaceOutputBuffer(size).order(ByteOrder.nativeOrder());
        int rate = inputAudioFormat.sampleRate;
        if (changed || rate != appliedRate) {
            changed = false;
            updateCoefficients(rate);
        }
        boolean any = false;
        for (boolean on : bandOn) any |= on;
        if (!any) {
            out.put(inputBuffer);
            out.flip();
            return;
        }
        int channels = inputAudioFormat.channelCount;
        while (inputBuffer.hasRemaining()) {
            for (int c = 0; c < channels; c++) {
                double x = inputBuffer.getShort() / 32768.0;
                for (int b = 0; b < FREQS.length; b++) {
                    if (!bandOn[b]) continue;
                    double[] k = coef[b];
                    double[] s = state[b][c];
                    double y = k[0] * x + k[1] * s[0] + k[2] * s[1] - k[3] * s[2] - k[4] * s[3];
                    s[1] = s[0];
                    s[0] = x;
                    s[3] = s[2];
                    s[2] = y;
                    x = y;
                }
                double v = x * 32768.0;
                if (v > 32767) v = 32767;
                else if (v < -32768) v = -32768;
                out.putShort((short) v);
            }
        }
        out.flip();
    }

    @Override
    protected void onFlush() {
        for (double[][] band : state) for (double[] s : band) java.util.Arrays.fill(s, 0);
    }
}
