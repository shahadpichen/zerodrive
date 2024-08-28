import Dexie from "dexie";
import dexieCloud from "dexie-cloud-addon";

export interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  userEmail: string;
}

const db = new Dexie("CryptoDriveDB", { addons: [dexieCloud] });

db.version(1).stores({
  files: "id, name, mimeType, userEmail",
});

const databaseUrl = process.env.REACT_APP_PUBLIC_DEXIE_CLOUD_URL;

if (!databaseUrl) {
  throw new Error(
    "Dexie Cloud database URL is not defined in environment variables"
  );
}

db.cloud.configure({
  databaseUrl: databaseUrl,
  requireAuth: true,
});

const addFile = async (file: FileMeta) => {
  return await db.table<FileMeta>("files").add(file);
};

const getAllFilesForUser = async (userEmail: string) => {
  return await db
    .table<FileMeta>("files")
    .where("userEmail")
    .equals(userEmail)
    .toArray();
};

const getFileByIdForUser = async (id: string, userEmail: string) => {
  return await db.table<FileMeta>("files").where({ id, userEmail }).first();
};

export { db, addFile, getAllFilesForUser, getFileByIdForUser };
