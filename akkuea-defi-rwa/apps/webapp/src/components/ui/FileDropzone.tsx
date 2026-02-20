"use client";

import { useState, DragEvent, ChangeEvent } from "react";

type FileDropzoneProps = {
  label?: string;
  accept?: string;
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
};

export default function FileDropzone({
  label = "Drag & drop files here",
  accept,
  multiple = false,
  onFilesChange,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const selectedFiles = Array.from(fileList);
    setFiles(selectedFiles);
    onFilesChange?.(selectedFiles);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300"
        }`}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          id={label}
          onChange={handleChange}
        />
        <label htmlFor={label} className="cursor-pointer block">
          {label}
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          {files.map((file, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded border">
              {file.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}