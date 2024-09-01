export const decryptFile = async (fileBlob: Blob): Promise<Blob> => {
  const keyJWK = JSON.parse(localStorage.getItem("aes-gcm-key") || "{}");
  const key = await crypto.subtle.importKey(
    "jwk",
    keyJWK,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  const fileArrayBuffer = await fileBlob.arrayBuffer();
  const iv = new Uint8Array(12);
  iv.set(new Uint8Array(fileArrayBuffer.slice(0, 12)));
  const encryptedData = new Uint8Array(fileArrayBuffer.slice(12));

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encryptedData
  );

  return new Blob([decryptedBuffer]);
};
