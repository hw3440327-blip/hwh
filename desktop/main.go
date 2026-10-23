// Next Spring's portable desktop shell serves only its embedded, verified game.
// It uses a dedicated browser profile; no game or voice service is contacted.
package main

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const version = "4.3.0"
const desktopPort = 19842 // Stable origin preserves the browser's local saves.

// Explicit types avoid relying on file associations in the Windows registry.
var contentTypes = map[string]string{
	".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8", ".json": "application/json",
	".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2",
	".mp3": "audio/mpeg", ".ogg": "audio/ogg",
}

// Populated from the production asset allowlist by scripts/package-desktop.py.
//
//go:embed payload/*
var payload embed.FS

type asset struct {
	File   string `json:"file"`
	Bytes  int    `json:"bytes"`
	SHA256 string `json:"sha256"`
}
type manifest struct {
	Version string  `json:"version"`
	Files   []asset `json:"files"`
}

func loadAssets() (fs.FS, manifest, error) {
	root, err := fs.Sub(payload, "payload")
	if err != nil {
		return nil, manifest{}, err
	}
	data, err := fs.ReadFile(root, "asset-manifest.json")
	if err != nil {
		return nil, manifest{}, err
	}
	var m manifest
	if err = json.Unmarshal(data, &m); err != nil {
		return nil, m, err
	}
	if m.Version != version || len(m.Files) < 250 {
		return nil, m, errors.New("incomplete game manifest")
	}
	return root, m, nil
}

func verifyAssets(root fs.FS, m manifest) error {
	seen := make(map[string]bool)
	for _, a := range m.Files {
		if !fs.ValidPath(a.File) || seen[a.File] {
			return fmt.Errorf("invalid asset: %s", a.File)
		}
		seen[a.File] = true
		data, err := fs.ReadFile(root, a.File)
		if err != nil {
			return err
		}
		digest := sha256.Sum256(data)
		if len(data) != a.Bytes || hex.EncodeToString(digest[:]) != a.SHA256 {
			return fmt.Errorf("damaged asset: %s", a.File)
		}
	}
	if !seen["index.html"] {
		return errors.New("missing game entry")
	}
	return nil
}

// Nothing is served from the user's disk, and only the loopback address is used.
func gameHandler(root fs.FS, m manifest, port int) http.Handler {
	allowed := make(map[string]bool)
	for _, a := range m.Files {
		allowed[a.File] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != net.JoinHostPort("127.0.0.1", strconv.Itoa(port)) {
			http.Error(w, "Local game only", http.StatusForbidden)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/hwh/", http.StatusTemporaryRedirect)
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/hwh/") {
			http.NotFound(w, r)
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/hwh/")
		if name == "" {
			name = "index.html"
		}
		if !allowed[name] || !fs.ValidPath(name) {
			http.NotFound(w, r)
			return
		}
		data, err := fs.ReadFile(root, name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if name == "index.html" {
			w.Header().Set("Cache-Control", "no-store")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		if kind := contentTypes[filepath.Ext(name)]; kind != "" {
			w.Header().Set("Content-Type", kind)
		}
		http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(data))
	})
}

func dataDirectory() (string, error) {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		var err error
		base, err = os.UserCacheDir()
		if err != nil {
			return "", err
		}
	}
	dir := filepath.Join(base, "NextSpringDesktop")
	return dir, os.MkdirAll(dir, 0700)
}

func run() error {
	check := flag.Bool("verify-assets", false, "Verify the embedded game and exit")
	serveOnly := flag.Bool("serve-only", false, "Run the local game server for validation")
	port := flag.Int("port", desktopPort, "Local validation port; normal play uses a stable port")
	flag.Parse()
	root, m, err := loadAssets()
	if err != nil {
		return fmt.Errorf("游戏资源没有完整读入：%w", err)
	}
	if *check {
		if err = verifyAssets(root, m); err != nil {
			return err
		}
		fmt.Printf("Next Spring %s: %d embedded files verified\n", version, len(m.Files))
		return nil
	}
	if !*serveOnly {
		*port = desktopPort
	}
	listener, err := net.Listen("tcp4", net.JoinHostPort("127.0.0.1", strconv.Itoa(*port)))
	if err != nil {
		return errors.New("本机的游戏入口暂时被占用。请关闭已打开的游戏窗口，再启动；没有清除或更换你的存档")
	}
	defer listener.Close()
	server := &http.Server{Handler: gameHandler(root, m, *port), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32768}
	if *serveOnly {
		log.Printf("Next Spring %s at http://127.0.0.1:%d/hwh/", version, *port)
		return server.Serve(listener)
	}
	dir, err := dataDirectory()
	if err != nil {
		return errors.New("暂时无法保存桌面版数据，请把应用放到你可以使用的文件夹后再打开")
	}
	if file, e := os.OpenFile(filepath.Join(dir, "desktop.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600); e == nil {
		defer file.Close()
		log.SetOutput(file)
	}
	go func() {
		if e := server.Serve(listener); e != nil && !errors.Is(e, http.ErrServerClosed) {
			log.Print(e)
		}
	}()
	defer server.Close()
	return launchWindow("http://127.0.0.1:"+strconv.Itoa(*port)+"/hwh/?desktop="+version, filepath.Join(dir, "profile"))
}

func main() {
	// Acquire the per-user lock before binding, but keep asset validation read-only.
	release, err := lockInstance()
	if err != nil {
		showError(err.Error())
		return
	}
	defer release()
	if err = run(); err != nil {
		log.Print(err)
		showError(err.Error())
		os.Exit(1)
	}
}
