"use client"

import { useState } from "react";
import DragDropUpload from "../ui/FileDropzone";
import FileDropzone from "../ui/FileDropzone";





export default function StepTwo() {
    const [profileImage, setProfileImage] = useState<File[]>([]);
    const [documents, setDocuments] = useState<File[]>([]);


    return (
        <div className="flex flex-col gap-6 items-start  w-full" >
            <h2 className="text-[#ff3e00] font-semibold text-xl md:text-2xl  " >Upload Documents</h2>


            <div className=" w-full grid grid-cols-1  place-items-center justify-center justify-items-center gap-7 " >

                <FileDropzone
                    label="Upload Profile Image"
                    accept="image/*"
                    multiple={false}
                    onFilesChange={(files) => setProfileImage(files)}
                />

                <FileDropzone
                    label="Upload Documents"
                    accept=".pdf,.doc,.docx"
                    multiple={true}
                    onFilesChange={(files) => setDocuments(files)}
                />


            </div>

        </div>
    )
}