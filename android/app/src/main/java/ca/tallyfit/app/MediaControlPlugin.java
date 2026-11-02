package ca.tallyfit.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Music controls for workouts. Sends the same media-button presses as headphone buttons,
 * so it controls whatever app is playing (YouTube Music, Spotify, ...). Needs no special permissions.
 * duck() briefly lowers the music while Tally's timer beeps play.
 */
@CapacitorPlugin(name = "MediaControl")
public class MediaControlPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());

    private AudioManager audio() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    private void press(int keyCode) {
        AudioManager am = audio();
        long t = SystemClock.uptimeMillis();
        am.dispatchMediaKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_DOWN, keyCode, 0));
        am.dispatchMediaKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_UP, keyCode, 0));
    }

    private void resolveState(PluginCall call, int delayMs) {
        main.postDelayed(() -> {
            JSObject r = new JSObject();
            r.put("playing", audio().isMusicActive());
            call.resolve(r);
        }, delayMs);
    }

    @PluginMethod
    public void state(PluginCall call) {
        resolveState(call, 0);
    }

    @PluginMethod
    public void playPause(PluginCall call) {
        press(audio().isMusicActive() ? KeyEvent.KEYCODE_MEDIA_PAUSE : KeyEvent.KEYCODE_MEDIA_PLAY);
        resolveState(call, 600);
    }

    @PluginMethod
    public void next(PluginCall call) {
        press(KeyEvent.KEYCODE_MEDIA_NEXT);
        resolveState(call, 600);
    }

    @PluginMethod
    public void previous(PluginCall call) {
        press(KeyEvent.KEYCODE_MEDIA_PREVIOUS);
        resolveState(call, 600);
    }

    @PluginMethod
    public void duck(PluginCall call) {
        int ms = Math.max(300, Math.min(10000, call.getInt("ms", 1500)));
        AudioManager am = audio();
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        AudioFocusRequest req = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attrs)
                .build();
        am.requestAudioFocus(req);
        main.postDelayed(() -> am.abandonAudioFocusRequest(req), ms);
        call.resolve();
    }
}
