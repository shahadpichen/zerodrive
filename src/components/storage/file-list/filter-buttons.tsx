import React from "react";
import { Badge } from "../../ui/badge";
import { MimeTypeCategory } from "../../../lib/mime-types";

const badgeColors = [
  { bg: "#e6f0ff", text: "#15326d" }, // Light Blue
  { bg: "#ffe6e6", text: "#8c1515" }, // Light Red
  { bg: "#e6fff0", text: "#035a42" }, // Light Green
  { bg: "#f0e6ff", text: "#5c2cb3" }, // Light Purple
  { bg: "#fff0e6", text: "#9a3309" }, // Light Orange
  { bg: "#e6f7ff", text: "#024f78" }, // Light Ocean Blue
  { bg: "#e6f7ff", text: "#3a5d0b" }, // Light Forest Green
  { bg: "#f2e6ff", text: "#521ea3" }, // Light Royal Purple
  { bg: "#ffe6ec", text: "#8f0e2d" }, // Light Ruby Red
  { bg: "#e6fffd", text: "#0b5853" }, // Light Teal
  { bg: "#fff2e6", text: "#63390a" }, // Light Bronze
];

interface FilterButtonsProps {
  filter: MimeTypeCategory | "All Files";
  setFilter: (filter: MimeTypeCategory | "All Files") => void;
  availableFilters: (MimeTypeCategory | "All Files")[];
}

export const FilterButtons: React.FC<FilterButtonsProps> = ({
  filter,
  setFilter,
  availableFilters,
}) => {
  return (
    <div className="flex py-3 flex-col md:flex-row justify-between items-start gap-4">
      <div className="flex justify-center flex-wrap gap-2 md:gap-4 items-center">
        {availableFilters.map((category, index) => (
          <Badge
            key={category}
            onClick={() =>
              setFilter(category as MimeTypeCategory | "All Files")
            }
            className={`cursor-pointer text-sm px-3 py-1 rounded-full transition-shadow ${
              filter === category ? "shadow-lg border border-gray-300" : ""
            }`}
            style={{
              backgroundColor:
                category === "All Files"
                  ? "black"
                  : badgeColors[index % badgeColors.length].bg,
              color:
                category === "All Files"
                  ? "white"
                  : badgeColors[index % badgeColors.length].text,
            }}
          >
            {category}
          </Badge>
        ))}
      </div>
    </div>
  );
};
