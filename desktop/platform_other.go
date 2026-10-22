//go:build !windows

package main

import (
	"errors"
	"fmt"
	"os"
)

func lockInstance() (func(), error) { return func() {}, nil }
func showError(message string)      { fmt.Fprintln(os.Stderr, message) }
func launchWindow(url, profile string) error {
	return errors.New("this desktop package targets Windows; use --serve-only for local validation")
}
