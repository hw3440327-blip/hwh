package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
)

func request(h http.Handler, method, path, host string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://127.0.0.1:19842"+path, nil)
	r.Host = host
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestEmbeddedProductionIsComplete(t *testing.T) {
	root, m, err := loadAssets()
	if err != nil {
		t.Fatal(err)
	}
	if err = verifyAssets(root, m); err != nil {
		t.Fatal(err)
	}
}

func TestOnlyLocalPublishedFilesCanBeRead(t *testing.T) {
	root, m, _ := loadAssets()
	h := gameHandler(root, m, desktopPort)
	for _, test := range []struct {
		method, path, host string
		status             int
	}{
		{"GET", "/hwh/", "127.0.0.1:19842", 200},
		{"HEAD", "/hwh/", "127.0.0.1:19842", 200},
		{"GET", "/", "127.0.0.1:19842", 307},
		{"GET", "/hwh/", "other.example:19842", 403},
		{"GET", "/hwh/", "127.0.0.1:19843", 403},
		{"POST", "/hwh/", "127.0.0.1:19842", 405},
		{"GET", "/hwh/art/", "127.0.0.1:19842", 404},
		{"GET", "/hwh/../go.mod", "127.0.0.1:19842", 404},
		{"GET", "/hwh/asset-manifest.json", "127.0.0.1:19842", 404},
		{"GET", "/hwh/offline-8k-test.html", "127.0.0.1:19842", 404},
	} {
		if got := request(h, test.method, test.path, test.host).Code; got != test.status {
			t.Errorf("%s %s host=%s got %d want %d", test.method, test.path, test.host, got, test.status)
		}
	}
}

func TestPublishedBytesAndAudioRangesMatchTheGame(t *testing.T) {
	root, m, _ := loadAssets()
	h := gameHandler(root, m, desktopPort)
	for _, a := range m.Files {
		w := request(h, "GET", "/hwh/"+a.File+"?v=desktop", "127.0.0.1:19842")
		if w.Code != 200 {
			t.Fatalf("asset %s: %d", a.File, w.Code)
		}
		digest := sha256.Sum256(w.Body.Bytes())
		if hex.EncodeToString(digest[:]) != a.SHA256 {
			t.Fatalf("wrong body %s", a.File)
		}
		if a.File == "index.html" && w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("entry can become stale")
		}
		if w.Header().Get("X-Content-Type-Options") != "nosniff" {
			t.Fatal("missing content type guard")
		}
		if w.Header().Get("Content-Type") == "" {
			t.Fatalf("missing portable MIME type: %s", a.File)
		}
	}
	for _, a := range m.Files {
		if len(a.File) > 4 && a.File[len(a.File)-4:] == ".mp3" {
			r := httptest.NewRequest("GET", "http://127.0.0.1:19842/hwh/"+a.File, nil)
			r.Host = "127.0.0.1:19842"
			r.Header.Set("Range", "bytes=0-31")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			data, _ := fs.ReadFile(root, a.File)
			if w.Code != 206 || !bytes.Equal(w.Body.Bytes(), data[:32]) {
				t.Fatal("audio range playback is broken")
			}
			break
		}
	}
}
