'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTestingWizard } from '@/hooks/useTestingWizard';
import {
  DocumentArrowUpIcon,
  DocumentTextIcon,
  PhotoIcon,
  TrashIcon,
  CloudArrowUpIcon,
  EyeIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface UploadedFile {
  id: string;
  file: File;
  description: string;
  type: string;
  uploadDate: Date;
  preview?: string;
}

const evidenceTypes = [
  { value: 'SCREENSHOT', label: 'Screenshot' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'LOG', label: 'System Log' },
  { value: 'REPORT', label: 'Report' },
  { value: 'CONFIGURATION', label: 'Configuration File' },
  { value: 'OTHER', label: 'Other' },
];

export default function EvidenceCollectionStep() {
  const { formData, updateFormData, nextStep } = useTestingWizard();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [evidenceNotes, setEvidenceNotes] = useState(formData.evidenceNotes || '');
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      description: '',
      type: 'DOCUMENT',
      uploadDate: new Date(),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
      'application/msword': ['.doc', '.docx'],
      'text/*': ['.txt', '.csv', '.log'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleFileDescriptionChange = (fileId: string, description: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, description } : f
    ));
  };

  const handleFileTypeChange = (fileId: string, type: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, type } : f
    ));
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
    }
  };

  const handleNext = () => {
    updateFormData({
      evidence: {
        files: uploadedFiles.map(f => f.file),
        descriptions: uploadedFiles.map(f => f.description),
        types: uploadedFiles.map(f => f.type),
      },
      evidenceNotes,
    });
    nextStep();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center">
            <DocumentArrowUpIcon className="h-5 w-5 mr-2 text-gray-400" />
            Evidence Collection
          </h3>
        </div>
        
        <div className="px-6 py-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              {isDragActive ? 'Drop files here' : 'Drag and drop files, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Supports images, PDFs, documents, and log files (max 10MB)
            </p>
          </div>
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Uploaded Evidence ({uploadedFiles.length} files)
              </h3>
              <span className="text-sm text-gray-500">
                Total: {formatFileSize(uploadedFiles.reduce((acc, f) => acc + f.file.size, 0))}
              </span>
            </div>
          </div>
          
          <div className="px-6 py-4">
            <div className="space-y-4">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start space-x-4">
                    {/* File Icon/Preview */}
                    <div className="flex-shrink-0">
                      {file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.file.name}
                          className="h-16 w-16 rounded object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-gray-100 rounded flex items-center justify-center">
                          {file.file.type.includes('pdf') ? (
                            <DocumentTextIcon className="h-8 w-8 text-red-500" />
                          ) : (
                            <DocumentTextIcon className="h-8 w-8 text-gray-400" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* File Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.file.size)} • Uploaded {new Date(file.uploadDate).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {file.preview && (
                            <button
                              onClick={() => setSelectedFile(file)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Preview"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveFile(file.id)}
                            className="p-1 text-red-400 hover:text-red-600"
                            title="Remove"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Type and Description */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Evidence Type
                          </label>
                          <select
                            value={file.type}
                            onChange={(e) => handleFileTypeChange(file.id, e.target.value)}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                          >
                            {evidenceTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={file.description}
                            onChange={(e) => handleFileDescriptionChange(file.id, e.target.value)}
                            placeholder="Brief description..."
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Evidence Notes */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Evidence Notes</h3>
        </div>
        <div className="px-6 py-4">
          <textarea
            value={evidenceNotes}
            onChange={(e) => setEvidenceNotes(e.target.value)}
            placeholder="Provide context for the uploaded evidence, explain what each file demonstrates..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            rows={4}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex">
          <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Evidence Summary</h3>
            <p className="mt-1 text-sm text-green-700">
              {uploadedFiles.length > 0 
                ? `${uploadedFiles.length} file(s) uploaded successfully. Ensure all evidence is properly labeled and described.`
                : 'Upload evidence to support your test findings. Include screenshots, logs, and relevant documentation.'}
            </p>
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      {selectedFile && selectedFile.preview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedFile(null)} />
            <div className="relative bg-white rounded-lg max-w-3xl w-full">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  onClick={() => setSelectedFile(null)}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6">
                <img
                  src={selectedFile.preview}
                  alt={selectedFile.file.name}
                  className="w-full h-auto"
                />
                <p className="mt-4 text-sm text-gray-500 text-center">
                  {selectedFile.file.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}