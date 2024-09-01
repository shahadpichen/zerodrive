import React from "react";

interface FileNamesDisplayProps {
  fileNames: string[];
}

const FileNamesDisplay: React.FC<FileNamesDisplayProps> = ({ fileNames }) => (
  <div>
    {fileNames.length > 0 ? (
      <ul className="list-disc list-inside">
        {fileNames.map((name, index) => (
          <li key={index} className="text-gray-600">
            {name}
          </li>
        ))}
      </ul>
    ) : (
      <div className="text-center pointer-events-none">
        <p className="text-gray-500">
          Drag and drop files here, or{" "}
          <span className="text-blue-500 font-semibold underline mt-2">
            Browse
          </span>
        </p>
      </div>
    )}
  </div>
);

export default FileNamesDisplay;
