package com.boatmatey.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Enable edge-to-edge for Android 15+ (SDK 35) and backward compatibility.
        // Addresses Play Console: "Edge-to-edge may not display for all users" and
        // migrates away from deprecated LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
