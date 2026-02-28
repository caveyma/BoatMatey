package com.boatmatey.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Edge-to-edge disabled: EdgeToEdge.enable(this) caused WebView to show blank white
        // screen on Android (content in DOM but not painted). Re-enable once insets are handled.
        super.onCreate(savedInstanceState);
    }
}
