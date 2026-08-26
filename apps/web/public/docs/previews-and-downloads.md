---
title: Preview and download files
description: Learn what the browser decrypts, which previews are supported, and when downloading is better.
category: storage
order: 3
updated: 2026-08-26
analyticsKey: docs_previews_downloads
---

## What preview does

Preview downloads the encrypted object from Google Drive, verifies it, and decrypts it in your browser. The readable result exists on the device for as long as the preview needs it; the ZeroDrive backend does not receive the plaintext.

Opening a file can therefore take longer than opening an ordinary Drive preview. ZeroDrive must fetch and decrypt the protected object before the browser can render it.

## Supported previews

Common images, PDFs, text, audio, and browser-supported video formats can be previewed. Office documents may use local browser libraries to extract a view. Support still depends on the browser's media codecs and memory limits.

HEIC files are identified as images. ZeroDrive attempts local conversion for preview, but browser and device support varies. If conversion is unavailable or fails, download the file and open it in a native application that supports HEIC.

## Large previews

Large files can take a long time because the current Capsule path decrypts the full object before preview. After one minute, the preview explains that downloading may be a better option.

Closing the preview should release temporary object URLs and buffers where the browser permits it. On memory-constrained devices, download large videos instead of repeatedly previewing them.

## Downloading

Download performs the same authenticated decryption but saves the readable result to your device. The downloaded plaintext is no longer protected by ZeroDrive encryption, so store or share it according to its sensitivity.

A downloaded file does not remove the encrypted Storage copy. Delete the Storage item separately if you no longer need it.
