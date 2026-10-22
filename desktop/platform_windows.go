//go:build windows

package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

func showError(message string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	title, _ := syscall.UTF16PtrFromString("下一次春天")
	body, _ := syscall.UTF16PtrFromString(message)
	user32.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x10)
}

func lockInstance() (func(), error) {
	name, _ := syscall.UTF16PtrFromString(`Local\NextSpringDesktop4`)
	kernel := syscall.NewLazyDLL("kernel32.dll")
	h, _, e := kernel.NewProc("CreateMutexW").Call(0, 0, uintptr(unsafe.Pointer(name)))
	if h == 0 {
		return nil, errors.New("暂时无法启动游戏窗口，请稍后再试")
	}
	if e == syscall.Errno(183) {
		kernel.NewProc("CloseHandle").Call(h)
		return nil, errors.New("游戏已经在运行，请切换到已打开的“下一次春天”窗口")
	}
	return func() { kernel.NewProc("CloseHandle").Call(h) }, nil
}

func launchWindow(url, profile string) error {
	var candidates []string
	for _, base := range []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LOCALAPPDATA")} {
		if base != "" {
			candidates = append(candidates, filepath.Join(base, "Microsoft", "Edge", "Application", "msedge.exe"))
		}
	}
	for _, base := range []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")} {
		if base != "" {
			candidates = append(candidates, filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe"))
		}
	}
	for _, candidate := range candidates {
		if stat, err := os.Stat(candidate); err != nil || stat.IsDir() {
			continue
		}
		cmd := exec.Command(candidate, "--app="+url, "--user-data-dir="+profile, "--no-first-run", "--no-default-browser-check", "--disable-background-mode", "--disable-sync", "--disable-extensions")
		// Keep the normal browser sandbox. This profile is separate from everyday browsing.
		if err := cmd.Start(); err != nil {
			continue
		}
		return cmd.Wait()
	}
	return errors.New("需要电脑已安装的 Microsoft Edge 或 Chrome 来显示游戏窗口。安装或修复浏览器后，再双击游戏；无需安装游戏运行库")
}
