package com.tiktokviralcoach;

import android.provider.Settings;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import java.security.MessageDigest;

public class DeviceIdModule extends ReactContextBaseJavaModule {

    DeviceIdModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "DeviceId";
    }

    @ReactMethod
    public void getDeviceId(Promise promise) {
        try {
            String androidId = Settings.Secure.getString(
                getReactApplicationContext().getContentResolver(),
                Settings.Secure.ANDROID_ID
            );
            // Hash it so the raw ANDROID_ID isn't sent to the server
            String hashed = sha256("crescio_" + androidId);
            promise.resolve(hashed);
        } catch (Exception e) {
            promise.reject("DEVICE_ID_ERROR", e.getMessage());
        }
    }

    private String sha256(String input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(input.getBytes("UTF-8"));
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString().substring(0, 32); // 32-char device ID
    }
}
