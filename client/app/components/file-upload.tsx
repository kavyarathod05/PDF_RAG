'use client';
import * as React from 'react';
import { Upload } from 'lucide-react';

const FileUploadComponent: React.FC = () => {
  const handleFileUploadButtonClick = () => {
    const el = document.createElement('input');
    el.setAttribute('type', 'file');
    el.setAttribute('accept', 'application/pdf');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    el.addEventListener('change', async (ev) => {
      if (el.files && el.files.length>0) {
          const file= el.files.item(0);
          if(file){
            const formData = new FormData();
            formData.append('pdf', file);
            console.log(formData);
           await fetch(`${process.env.BACKEND_URL}/upload/pdf`, {
              method: 'POST',
              body: formData
            });
            console.log('file uploaded');
          }
          
      }
    });
    el.click();
  };

  return (
    <div className="bg-slate-900 text-white shadow-2xl flex justify-center items-center p-4 rounded-lg border-white border-2">
      <div
        onClick={handleFileUploadButtonClick}
        className="flex justify-center items-center flex-col"
      >
        <h3>Upload PDF File</h3>
        <Upload />
      </div>
    </div>
  );
};

export default FileUploadComponent;