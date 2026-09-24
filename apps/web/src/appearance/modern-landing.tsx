import {
  ArrowUpRight,
  FileText,
  FolderLock,
  Image,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";

export function VaultIllustration() {
  return (
    <figure className="vault-illustration relative mx-auto w-full max-w-lg">
      <div className="overflow-hidden rounded-sm border bg-card text-card-foreground">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FolderLock className="h-4 w-4" /> My vault
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <LockKeyhole className="h-3 w-3" />
            Encrypted
          </span>
        </div>
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-sm font-medium">All files</span>
            <span className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              <Upload className="h-3 w-3" /> Upload
            </span>
          </div>
          {[
            {
              name: "Weekend memories.jpg",
              detail: "Image · 2.4 MB",
              Icon: Image,
            },
            {
              name: "Project notes.pdf",
              detail: "Document · 840 KB",
              Icon: FileText,
            },
            {
              name: "Personal documents",
              detail: "Folder · 3 files",
              Icon: FolderLock,
            },
          ].map(({ name, detail, Icon }) => (
            <div
              key={name}
              className="flex items-center gap-3 border-b py-4 last:border-0"
            >
              <div className="rounded-sm bg-muted p-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </div>
              <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t bg-muted/40 px-6 py-4 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Protected here. Stored in your
          Google Drive.
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-muted-foreground">
        Illustrative preview · sample files
      </figcaption>
    </figure>
  );
}

export function ModernLandingSections() {
  return (
    <div className="mx-auto max-w-6xl space-y-24 px-6 py-20 sm:px-10">
      <section aria-labelledby="modern-how-it-works">
        <p className="modern-eyebrow mb-3 text-muted-foreground">
          Simple by design
        </p>
        <h2 id="modern-how-it-works" className="max-w-xl text-3xl sm:text-4xl">
          A little more privacy.
          <br />A lot more peace of mind.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Connect your Drive",
              text: "Sign in with Google and approve limited access for encrypted files and app metadata.",
              Icon: FolderLock,
            },
            {
              title: "Keep your recovery phrase",
              text: "Create a vault key or recover your existing one. Save your phrase somewhere safe—you will need it on another device.",
              Icon: KeyRound,
            },
            {
              title: "Make yourself at home",
              text: "Upload and organize files. Encryption happens in your browser before protected copies reach Google Drive.",
              Icon: Upload,
            },
          ].map(({ title, text, Icon }, index) => (
            <article key={title} className="rounded-sm border-t p-7">
              <div className="mb-6 flex items-center justify-between">
                <Icon className="h-6 w-6" />
                <span className="modern-eyebrow text-primary">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mb-3 text-xl">{title}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="grid gap-8 rounded-sm border-y py-10 md:grid-cols-2">
        <div>
          <p className="modern-eyebrow mb-3 text-muted-foreground">
            Private means personal
          </p>
          <h2 className="text-3xl sm:text-4xl">
            Your keys.
            <br />
            Your responsibility.
          </h2>
        </div>
        <div className="space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            ZeroDrive cannot read your original files or reset your recovery
            phrase. Keep a safe copy before you start uploading.
          </p>
          <p>
            Secure sharing uses a separate sharing identity. Both people need to
            set up access before an encrypted file can be shared.
          </p>
          <Link
            to="/docs/keys-and-recovery"
            className="inline-flex items-center gap-2 font-semibold text-foreground underline underline-offset-4"
          >
            Understand recovery <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      <section className="text-center">
        <p className="modern-eyebrow mb-3 text-muted-foreground">
          Open source. Open to inspection.
        </p>
        <h2 className="text-3xl sm:text-4xl">Know what protects your files.</h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
          Read how encryption, Google permissions, and recovery work before you
          connect your account.
        </p>
        <Link
          to="/docs"
          className="mt-6 inline-flex items-center gap-2 font-semibold underline underline-offset-4"
        >
          Explore the guides <ArrowUpRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
