import Dexie from "dexie";

export interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  userEmail: string;
  uploadedDate: Date;
}

const db = new Dexie("CryptoDriveDB");

db.version(1).stores({
  files: "id, name, mimeType, userEmail, uploadedDate",
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
