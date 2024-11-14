import React from "react";

interface FileNamesDisplayProps {
  fileNames: string[];
}

const FileNamesDisplay: React.FC<FileNamesDisplayProps> = ({ fileNames }) => (
  <div>
    <ul className="list-disc list-inside">
      {fileNames.map((name, index) => (
        <li key={index} className="text-gray-600">
          {name}
        </li>
      ))}
    </ul>
  </div>
);

export default FileNamesDisplay;
