package com.dayris.calendar;

import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Scoped device credential, encrypted with a nonexportable Android Keystore key. */
final class VoiceWidgetStore {
    private static final String ALIAS = "dayris.widget.storage";
    private static final Object LOCK = new Object();
    private final AtomicFile file;
    VoiceWidgetStore(Context context) { file = new AtomicFile(new File(context.getNoBackupFilesDir(), "voice-widget.enc")); }
    private SecretKey key() throws Exception {
        if (Build.VERSION.SDK_INT < 23) throw new IllegalStateException("UNSUPPORTED_ANDROID");
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    JSONObject read() { synchronized (LOCK) { return readLocked(); } }
    private JSONObject readLocked() {
        try {
            String[] parts = new String(file.readFully(), "UTF-8").split("\n");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), "UTF-8"));
        } catch (Exception ignored) { return new JSONObject(); }
    }
    private synchronized void write(JSONObject state) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        String encrypted = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "\n" + Base64.encodeToString(cipher.doFinal(state.toString().getBytes("UTF-8")), Base64.NO_WRAP);
        FileOutputStream stream = file.startWrite();
        try { stream.write(encrypted.getBytes("UTF-8")); file.finishWrite(stream); }
        catch (Exception error) { file.failWrite(stream); throw error; }
    }
    JSONObject grant() { return read().optJSONObject("grant"); }
    JSONObject pending() { return read().optJSONObject("pending"); }
    void setGrant(JSONObject grant) throws Exception { synchronized (LOCK) { JSONObject state = new JSONObject(); state.put("grant", grant); write(state); } }
    void setPending(JSONObject pending) throws Exception { synchronized (LOCK) {
        JSONObject state = readLocked(); if (pending == null) state.remove("pending"); else state.put("pending", pending); write(state);
    }
    }
    void clear() { synchronized (LOCK) { file.delete(); } }
}
