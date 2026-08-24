"use client";

import React from "react";
import {
  ColumnDef,
  flexRender,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { deleteAndSyncFile } from "../../utils/fileOperations";
import { userNotifications as toast } from "../../utils/userNotifications";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  meta?: {
    updateData?: (newData: TData[]) => void;
    refetch?: () => void;
    downloadAndDecryptFile?: (fileId: string, fileName: string) => void;
    downloadingFileId?: string | null;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  meta,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [open, setOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
    meta: {
      ...meta,
    },
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const filesToDelete = selectedRows.map((row) => ({
      id: (row.original as any).id,
      name: (row.original as any).name, // Assuming 'name' is available on the row data
    }));
    const deleteToastId = "storage:delete-selected";
    let allSucceeded = true;

    try {
      toast.loading(`Deleting ${filesToDelete.length} selected files…`, {
        id: deleteToastId,
      });

      const { getUserEmail } = await import("../../utils/authService");
      const userEmail = await getUserEmail();

      if (!userEmail) {
        throw new Error("Cannot fetch user email - not signed in.");
      }

      for (const file of filesToDelete) {
        const success = await deleteAndSyncFile(file.id, file.name, userEmail, {
          notifications: false,
        });
        if (!success) {
          allSucceeded = false;
          // deleteAndSyncFile shows individual errors, but we track overall success
        }
      }

      if (allSucceeded && filesToDelete.length > 0) {
        toast.success(`Deleted ${filesToDelete.length} files`, {
          id: deleteToastId,
        });
      } else if (filesToDelete.length > 0) {
        // Handle partial success or complete failure
        toast.warning("Some files could not be deleted", {
          id: deleteToastId,
          description: "Refresh Storage and retry the files that remain.",
        });
      } else {
        // No files were selected or deleted
        toast.info("No files selected for deletion.", { id: deleteToastId });
      }

      // Reload or refetch regardless of partial success to update the UI
      // Consider using meta?.refetch?.() if available instead of reload
      window.location.reload();
      setRowSelection({}); // Clear selection after operation
    } catch (error: unknown) {
      console.error("Error deleting selected files:", error);
      toast.errorFrom(
        error,
        {
          title: "Selected files could not be deleted",
          description: "Refresh Storage and retry.",
        },
        { id: deleteToastId },
      );
    } finally {
      setIsDeleting(false);
      setOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {table.getFilteredSelectedRowModel().rows.length > 0 && (
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="h-8">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogDescription>
                  This action will delete{" "}
                  {table.getFilteredSelectedRowModel().rows.length} selected
                  file(s).
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <div className=" border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
