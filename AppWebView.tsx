import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

/**
 * AppWebView: O coração do myBooks no Celular.
 * Agora apontando para o seu site oficial no Vercel! ✨
 */

const IS_DEV = __DEV__;

const DEV_URL = Platform.OS === "android" ? "http://10.0.2.2:5173" : "http://localhost:5173";

// URL oficial que você acabou de criar no Vercel!
const PROD_URL = "https://bookzinhos-b76d69gwj-caios-projects-0c30cff6.vercel.app";

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const source = useMemo(() => {
    if (IS_DEV) return { uri: DEV_URL };
    return { uri: PROD_URL };
  }, [reloadKey]);

  if (hasError) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.title}>Ops! O myBooks tropeçou 🐼</Text>
        <Text style={styles.body}>
          Verifique sua conexão com a internet para carregar seus livros.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setHasError(false);
            setIsLoading(true);
            setReloadKey((v) => v + 1);
          }}
        >
          <Text style={styles.buttonText}>Tentar novamente ✨</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        key={reloadKey}
        source={source}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#64344f" />
          <Text style={styles.loadingText}>Abrindo o myBooks... 🐾</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function AppWebView() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#faf7f2" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf7f2",
    gap: 15,
  },
  loadingText: { color: "#282623", fontWeight: "800", fontSize: 16 },
  centered: {
    flex: 1,
    backgroundColor: "#faf7f2",
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  title: { fontSize: 22, fontBold: "900", color: "#282623", textAlign: "center" },
  body: { color: "#706558", textAlign: "center", lineHeight: 24, fontSize: 16 },
  button: {
    marginTop: 20,
    backgroundColor: "#B6A6EE",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: "#B6A6EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
