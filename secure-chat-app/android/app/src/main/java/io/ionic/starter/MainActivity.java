package io.ionic.starter;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }
    
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            
            // Incoming Call Channel - with ringtone
            NotificationChannel callChannel = new NotificationChannel(
                "incoming_call",
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            callChannel.setDescription("Notifications for incoming calls");
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{0, 500, 500, 500});
            
            // Set custom ringtone sound
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/ringtone");
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            callChannel.setSound(soundUri, audioAttributes);
            
            notificationManager.createNotificationChannel(callChannel);
            
            // Message Channel - default notification sound
            NotificationChannel messageChannel = new NotificationChannel(
                "messages",
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            messageChannel.setDescription("Notifications for new messages");
            messageChannel.enableVibration(true);
            
            notificationManager.createNotificationChannel(messageChannel);
        }
    }
}
