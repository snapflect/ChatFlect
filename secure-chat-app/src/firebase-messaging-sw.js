importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBKZyg2A16kNOOY43AFqHvzZ14r0o5fACM",
    authDomain: "chat-26c25.firebaseapp.com",
    projectId: "chat-26c25",
    storageBucket: "chat-26c25.firebasestorage.app",
    messagingSenderId: "1036135506512",
    appId: "1:1036135506512:web:f231fa787fcf0335f82755"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/icon/favicon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
