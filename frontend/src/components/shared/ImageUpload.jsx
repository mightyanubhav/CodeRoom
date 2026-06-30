import { useState, useRef } from 'react';

const CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const ImageUpload = ({ onInsert }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver]       = useState(false);
    const fileRef = useRef(null);

    const upload = async (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Only image files allowed');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('folder', 'questions');

            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                { method: 'POST', body: formData }
            );
            const data = await res.json();

            if (data.secure_url) {
                // Insert as markdown image
                onInsert(`![image](${data.secure_url})`);
            } else {
                alert('Upload failed: ' + (data.error?.message || 'Unknown error'));
            }
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) upload(file);
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) upload(file);
    };

    return (
        <div>
            {/* Drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    dragOver
                        ? 'border-[#238636] bg-[#1a2f1a]'
                        : 'border-[#30363d] hover:border-[#484f58] bg-[#0d1117]'
                }`}
            >
                {isUploading ? (
                    <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-[#238636]" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        <span className="text-xs text-[#8b949e]">Uploading...</span>
                    </div>
                ) : (
                    <div>
                        <p className="text-xs text-[#8b949e]">
                            📷 Drop image here or click to upload
                        </p>
                        <p className="text-xs text-[#484f58] mt-1">
                            PNG, JPG, GIF, SVG — inserts as markdown
                        </p>
                    </div>
                )}
            </div>

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
};

export default ImageUpload;