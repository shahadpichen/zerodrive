import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { FileMeta } from "../../../utils/dexieDB";
import { Button } from "../../ui/button";
import { Loader2 } from "lucide-react";
import { Checkbox } from "../../ui/checkbox";

type TableMeta = {
  downloadAndDecryptFile?: (fileId: string, fileName: string) => void;
  downloadingFileId?: string | null;
};

export const columns: ColumnDef<FileMeta, unknown>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: () => <div className="text-left">Name</div>,
    cell: ({ row }) => (
      <div className="text-left font-medium flex items-center gap-2">
        {row.original.name}
      </div>
    ),
  },
  {
    accessorKey: "uploadedDate",
    header: () => <div className="text-left">Upload Date</div>,
    cell: ({ row }) => {
      const date = row.original.uploadedDate;
      return (
        <div className="text-left text-muted-foreground">
          {date?.toLocaleString().split(",")[0]}
        </div>
      );
    },
  },
  {
    accessorKey: "mimeType",
    header: () => <div className="text-left">Type</div>,
    cell: ({ row }) => (
      <div className="text-left text-muted-foreground">
        {row.original.mimeType}
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as TableMeta;
      const downloadingFileId = meta?.downloadingFileId;
      const downloadAndDecryptFile = meta?.downloadAndDecryptFile;

      return (
        <div className="text-right">
          <Button
            onClick={() => {
              if (downloadAndDecryptFile) {
                const file = row.original;
                downloadAndDecryptFile(file.id, file.name);
              }
            }}
            variant="outline"
            size="sm"
            className="h-8 px-3"
            disabled={downloadingFileId === row.original.id}
          >
            {downloadingFileId === row.original.id ? (
              <Loader2 className="animate-spin size-4 mr-2" />
            ) : null}
            Download
          </Button>
        </div>
      );
    },
  },
];
