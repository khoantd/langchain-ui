import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { Button, Icon, Stack, Text } from "@chakra-ui/react";
import { TbFileUpload } from "react-icons/tb";
import FilePicker from "../file-picker";

export default function CsvDocument({ files, register }) {
  const validateFile = useCallback((fileList) => {
    if (fileList.length === 0) {
      return false;
    }
    
    const file = fileList[0];
    
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return 'Please upload a CSV file';
    }
    
    // Check file size (50MB = 50 * 1024 * 1024 bytes)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return 'File size must be less than 50MB';
    }
    
    // Check for empty file
    if (file.size === 0) {
      return 'File cannot be empty';
    }
    
    return true;
  }, []);

  return (
    <Stack
      padding={8}
      borderWidth="1px"
      borderRadius="sm"
      borderStyle="dashed"
      alignItems="center"
      justifyContent="center"
    >
      <FilePicker accept=".csv" {...register("file", { validate: validateFile })}>
        <Button
          size="sm"
          variant="ghost"
          fontWeight="normal"
          leftIcon={<Icon as={TbFileUpload} />}
          color="gray.500"
        >
          Select a CSV file (max 50MB)
        </Button>
      </FilePicker>
      {files?.length > 0 && (
        <Stack spacing={1} marginTop={2}>
          <Text color="gray.500" fontSize="xs">
            {files[0].name}
          </Text>
          <Text color="gray.400" fontSize="xs">
            Size: {(files[0].size / 1024 / 1024).toFixed(2)} MB
          </Text>
        </Stack>
      )}
    </Stack>
  );
}

CsvDocument.propTypes = {
  files: PropTypes.object,
  register: PropTypes.func,
};

CsvDocument.propTypes = {
  files: PropTypes.object,
  register: PropTypes.func,
  validate: PropTypes.func,
};
