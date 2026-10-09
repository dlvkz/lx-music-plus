package com.guichaguri.trackplayer.service.player;

import androidx.media3.common.C;
import androidx.media3.common.audio.BaseAudioProcessor;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * 3D stereo surround of the desktop app: the sound goes round the listener, a Web Audio PannerNode
 * (equal power panning, inverse distance) whose position turns by 1 degree every `2 * speed` ms,
 * at the distance `soundR`.
 */
public final class PannerAudioProcessor extends BaseAudioProcessor {
    private static final int CHUNK = 64;

    public static final PannerAudioProcessor INSTANCE = new PannerAudioProcessor();

    private volatile boolean enabled = false;
    private volatile float soundR = 0.5f;
    // ms per degree
    private volatile float msPerDegree = 50f;

    // audio thread
    private double degree = 0;
    private float prevL1 = 1, prevL2 = 0, prevR1 = 0, prevR2 = 1;

    private PannerAudioProcessor() {}

    /**
     * @param soundR distance (desktop setting / 10)
     * @param speed desktop setting (1 - 50)
     */
    public void setPanner(boolean enabled, float soundR, float speed) {
        this.soundR = soundR;
        this.msPerDegree = Math.max(1f, 2f * speed);
        if (this.enabled != enabled) degree = 0;
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    @Override
    protected AudioFormat onConfigure(AudioFormat inputAudioFormat) throws UnhandledAudioFormatException {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT || inputAudioFormat.channelCount != 2) {
            return AudioFormat.NOT_SET;
        }
        return inputAudioFormat;
    }

    /**
     * Gains of the 4 paths (inL->L, inR->L, inL->R, inR->R) for the source at this angle
     */
    private float[] gainsAt(double deg) {
        double rad = deg * Math.PI / 180;
        double r = soundR;
        double x = Math.sin(rad) * r;
        double y = Math.cos(rad) * r;
        double z = Math.cos(rad) * r;
        double distance = Math.sqrt(x * x + y * y + z * z);
        // inverse distance model, refDistance 1, rolloff 1
        double distanceGain = distance <= 1 ? 1 : 1 / distance;
        // azimuth (listener at 0, forward -z, up +y)
        double px = x, pz = z;
        double length = Math.sqrt(px * px + pz * pz);
        double azimuth = 0;
        if (length > 1e-9 && distance > 1e-9) {
            px /= length;
            pz /= length;
            azimuth = Math.toDegrees(Math.acos(Math.max(-1, Math.min(1, px))));
            double frontBack = -pz;
            if (frontBack < 0) azimuth = 360 - azimuth;
            if (azimuth >= 0 && azimuth <= 270) azimuth = 90 - azimuth;
            else azimuth = 450 - azimuth;
        }
        if (azimuth < -90) azimuth = -180 - azimuth;
        else if (azimuth > 90) azimuth = 180 - azimuth;
        double xPan = azimuth <= 0 ? (azimuth + 90) / 90 : azimuth / 90;
        float gainL = (float) (Math.cos(xPan * Math.PI / 2) * distanceGain);
        float gainR = (float) (Math.sin(xPan * Math.PI / 2) * distanceGain);
        float g = (float) distanceGain;
        if (azimuth <= 0) {
            // L = inL + inR * gainL, R = inR * gainR
            return new float[]{ g, gainL, 0, gainR };
        }
        // L = inL * gainL, R = inR + inL * gainR
        return new float[]{ gainL, 0, gainR, g };
    }

    @Override
    public void queueInput(ByteBuffer inputBuffer) {
        int size = inputBuffer.remaining();
        if (size == 0) return;
        inputBuffer.order(ByteOrder.nativeOrder());
        ByteBuffer out = replaceOutputBuffer(size).order(ByteOrder.nativeOrder());
        if (!enabled) {
            out.put(inputBuffer);
            out.flip();
            return;
        }
        int rate = inputAudioFormat.sampleRate;
        double degreesPerFrame = 1000.0 / msPerDegree / rate;
        int frames = size / 4;
        int done = 0;
        while (done < frames) {
            int n = Math.min(CHUNK, frames - done);
            degree = (degree + degreesPerFrame * n) % 360;
            float[] g = gainsAt(degree);
            // the gains go to their new values over the chunk
            for (int i = 0; i < n; i++) {
                float t = (i + 1f) / n;
                float l1 = prevL1 + (g[0] - prevL1) * t;
                float l2 = prevL2 + (g[1] - prevL2) * t;
                float r1 = prevR1 + (g[2] - prevR1) * t;
                float r2 = prevR2 + (g[3] - prevR2) * t;
                float inL = inputBuffer.getShort();
                float inR = inputBuffer.getShort();
                out.putShort(clamp(inL * l1 + inR * l2));
                out.putShort(clamp(inL * r1 + inR * r2));
            }
            prevL1 = g[0];
            prevL2 = g[1];
            prevR1 = g[2];
            prevR2 = g[3];
            done += n;
        }
        out.flip();
    }

    private static short clamp(float v) {
        if (v > 32767f) return 32767;
        if (v < -32768f) return -32768;
        return (short) v;
    }
}
