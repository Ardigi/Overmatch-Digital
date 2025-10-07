'use client';

import { Dialog, Transition } from '@headlessui/react';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LoadingButton } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';
import { useControls } from '@/hooks/api/useControls';
import { useUploadEvidence } from '@/hooks/api/useEvidence';
import { useProjects } from '@/hooks/api/useProjects';

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.enum(['policy', 'control', 'audit', 'assessment', 'general']),
  type: z.enum(['document', 'screenshot', 'log', 'report', 'configuration', 'other']),
  relatedControls: z.array(z.string()).optional(),
  relatedProjects: z.array(z.string()).optional(),
  expirationDate: z.string().optional(),
  tags: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface EvidenceUploadModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function EvidenceUploadModal({
  isOpen = false,
  onClose = () => {},
  onSuccess,
}: EvidenceUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { showSuccess, showError } = useToast();

  const uploadEvidence = useUploadEvidence();
  const { data: projects } = useProjects();
  const { data: controls } = useControls();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: UploadFormData) => {
    if (files.length === 0) {
      showError('No files selected', 'Please select at least one file to upload.');
      return;
    }

    try {
      // Upload files one by one (could be enhanced to support bulk upload)
      for (const file of files) {
        const metadata = {
          name: data.title,
          description: data.description,
          category: data.category,
          type: data.type,
          collectionDate: new Date().toISOString(),
          expirationDate: data.expirationDate,
          relatedControls: data.relatedControls,
          relatedProjects: data.relatedProjects,
          tags: data.tags ? data.tags.split(',').map((t) => t.trim()) : undefined,
        };

        await uploadEvidence.mutate({
          file,
          metadata,
          onProgress: (progress) => setUploadProgress(progress),
        });
      }

      showSuccess('Evidence uploaded', `${files.length} file(s) uploaded successfully.`);
      reset();
      setFiles([]);
      setUploadProgress(0);
      onSuccess?.();
      onClose();
    } catch (error) {
      showError('Upload failed', 'Failed to upload evidence. Please try again.');
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                <form onSubmit={handleSubmit(onSubmit)}>
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <div className="flex items-center justify-between mb-4">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold leading-6 text-gray-900"
                      >
                        Upload Evidence
                      </Dialog.Title>
                      <button
                        type="button"
                        className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {/* File Upload Area */}
                    <div
                      className={`mt-4 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg ${
                        isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="space-y-1 text-center">
                        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                          >
                            <span>Upload files</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              multiple
                              onChange={handleFileSelect}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, PDF, XLSX, DOCX up to 10MB
                        </p>
                      </div>
                    </div>

                    {/* Selected Files */}
                    {files.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900">Selected files</h4>
                        <ul className="mt-2 space-y-2">
                          {files.map((file, index) => (
                            <li
                              key={index}
                              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md"
                            >
                              <span className="text-sm text-gray-900">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XMarkIcon className="h-5 w-5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Form Fields */}
                    <div className="mt-6 grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                          Evidence Title
                        </label>
                        <input
                          type="text"
                          {...register('title')}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                        {errors.title && (
                          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor="description"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Description (Optional)
                        </label>
                        <textarea
                          {...register('description')}
                          rows={3}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="category"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Category
                        </label>
                        <select
                          {...register('category')}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        >
                          <option value="">Select category</option>
                          <option value="policy">Policy</option>
                          <option value="control">Control</option>
                          <option value="audit">Audit</option>
                          <option value="assessment">Assessment</option>
                          <option value="general">General</option>
                        </select>
                        {errors.category && (
                          <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                          Evidence Type
                        </label>
                        <select
                          {...register('type')}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        >
                          <option value="">Select type</option>
                          <option value="document">Document</option>
                          <option value="screenshot">Screenshot</option>
                          <option value="log">Log File</option>
                          <option value="configuration">Configuration</option>
                          <option value="report">Report</option>
                          <option value="other">Other</option>
                        </select>
                        {errors.type && (
                          <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="relatedProjects"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Related Projects (Optional)
                        </label>
                        <select
                          {...register('relatedProjects')}
                          multiple
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        >
                          {projects?.data?.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="relatedControls"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Related Controls (Optional)
                        </label>
                        <select
                          {...register('relatedControls')}
                          multiple
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        >
                          {controls?.data?.map((control) => (
                            <option key={control.id} value={control.id}>
                              {control.code} - {control.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="expirationDate"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Expiration Date (Optional)
                        </label>
                        <input
                          type="date"
                          {...register('expirationDate')}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                          Tags (Optional)
                        </label>
                        <input
                          type="text"
                          {...register('tags')}
                          placeholder="Comma separated tags"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <LoadingButton
                      type="submit"
                      loading={uploadEvidence.loading}
                      className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto"
                    >
                      {uploadEvidence.loading
                        ? `Uploading... ${uploadProgress}%`
                        : 'Upload Evidence'}
                    </LoadingButton>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
