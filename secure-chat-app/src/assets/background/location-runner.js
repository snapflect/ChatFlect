// Background Runner Script for Location Updates
// This runs in a separate JS context (not Angular)

addEventListener('updateLocation', async (resolve, reject, args) => {
    try {
        const { chatId, userId, expiresAt } = args;

        // Check if expired
        if (Date.now() >= expiresAt) {
            resolve({ expired: true });
            return;
        }

        // Get current position using Capacitor Geolocation
        // Note: Background runner has limited API access
        // We need to use fetch to send location to our API
        const position = await CapacitorGeolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000
        });

        if (position && position.coords) {
            // Send to Firebase via our API endpoint
            const response = await fetch('https://YOUR_API_URL/api/update_location.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: chatId,
                    userId: userId,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    expiresAt: expiresAt
                })
            });

            resolve({ success: true, lat: position.coords.latitude, lng: position.coords.longitude });
        } else {
            resolve({ success: false, error: 'No position' });
        }
    } catch (e) {
        reject(e.message || 'Background location update failed');
    }
});
