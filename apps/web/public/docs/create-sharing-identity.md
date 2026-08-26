---
title: Create your sharing identity
description: Prepare the recipient keys that let other ZeroDrive users send encrypted files to you.
category: sharing
order: 2
updated: 2026-08-26
analyticsKey: docs_create_sharing_identity
---

## Why it is needed

Personal Storage and recipient sharing solve different problems. Your recovery phrase protects your own vault. A sharing identity gives other users a public destination they can use to encrypt a file specifically for you.

Until the sharing identity exists, Share Files and Shared With Me explain what is missing and guide you through Recovery & Access rather than presenting an unexplained unlock step.

## Create the identity

Open **Share Files** or **Shared With Me** and choose **Create sharing identity**. If Recovery & Access is not active, ZeroDrive opens the recovery flow first and returns you to the original page afterward.

Your browser generates the recipient key pair. The public part is registered with the backend. The private part stays under your control and is backed up to Google's hidden application-data area only in encrypted form.

## Returning sessions

On later sessions, ZeroDrive can recover the encrypted sharing-key backup after you enter the matching recovery phrase. Background recovery is silent; the page should show a clear action only when your participation is needed.

Creating a completely different identity can affect old shares. Historical private keys are retained so that files sent to earlier key versions can still be opened when the matching backup is available.

## Public key changes

Senders may pin the fingerprint they first saw for your public sharing key. If your identity changes, they can receive a warning before encrypting another file. This helps detect unexpected directory changes after first contact.
