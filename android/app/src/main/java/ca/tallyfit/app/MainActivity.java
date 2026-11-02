package ca.tallyfit.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaControlPlugin.class); // music controls on the workout screens
        super.onCreate(savedInstanceState);
    }
}
