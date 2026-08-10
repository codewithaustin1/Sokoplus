import React, { memo } from "react";
import { Briefcase, Trash2, Users, Download } from "lucide-react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../../lib/firebase";

interface JobOffer {
  id?: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirementsString: string;
  active?: boolean;
}

interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  resumeName?: string;
  resumeDetails?: string;
  status: "pending" | "reviewed" | "shortlisted" | "rejected";
  createdAt: string;
}

interface CareersTabProps {
  jobOffers: JobOffer[];
  setJobOffers: React.Dispatch<React.SetStateAction<JobOffer[]>>;
  jobApplications: JobApplication[];
  setJobApplications: React.Dispatch<React.SetStateAction<JobApplication[]>>;
  subTab: string;
  setSubTab: (val: string) => void;
  setNewJob: (val: any) => void;
  setShowJobAddModal: (val: boolean) => void;
}

export const CareersTab: React.FC<CareersTabProps> = memo(({
  jobOffers,
  setJobOffers,
  jobApplications,
  setJobApplications,
  subTab,
  setSubTab,
  setNewJob,
  setShowJobAddModal,
}) => {
  return (
    <div className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6 sm:space-y-8 animate-fade-in text-gray-950 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 pb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Briefcase size={22} className="text-orange-600" />
            Careers Board
          </h2>
          <p className="text-sm text-gray-500 font-medium col-span-12">
            Create SokoPlus workspace listings, accept applications, evaluate candidate qualifications, and download encrypted resumes.
          </p>
        </div>
        
        <button
          onClick={() => {
            setNewJob({
              title: "",
              department: "Engineering",
              location: "Nairobi (Hybrid)",
              type: "Full-time",
              description: "",
              requirementsString: ""
            });
            setShowJobAddModal(true);
          }}
          className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs transition-all tracking-wide shadow-md shadow-orange-600/10 flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          + Create Job Offer
        </button>
      </div>

      <div className="flex space-x-2 border-b border-gray-100 pb-3">
        <button
          onClick={() => setSubTab("openings")}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            subTab === "openings" 
              ? "bg-orange-50 text-orange-700 border border-orange-100" 
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          Active Job Postings ({jobOffers.length})
        </button>
        <button
          onClick={() => setSubTab("applicants")}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            subTab === "applicants" 
              ? "bg-orange-50 text-orange-700 border border-orange-100" 
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          Candidates & Folders ({jobApplications.length})
        </button>
      </div>

      {subTab === "openings" ? (
        <div className="space-y-4">
          {jobOffers.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-gray-200 space-y-3">
              <Briefcase size={32} className="text-gray-300 mx-auto" />
              <p className="text-sm font-black text-gray-700">No Postings Created Yet</p>
              <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto">
                Click "Create Job Offer" to make your first job opening visible to job seekers.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-gray-100 shadow-sm">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-xs text-gray-400 font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Role Title</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium">
                  {jobOffers.map((j) => (
                    <tr key={j.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-black text-gray-900">{j.title}</td>
                      <td className="p-4"><span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-black tracking-wider uppercase text-gray-600">{j.department}</span></td>
                      <td className="p-4 text-xs font-semibold">{j.location}</td>
                      <td className="p-4 text-xs font-semibold">{j.type}</td>
                      <td className="p-4">
                        <button
                          onClick={async () => {
                            try {
                              if (!j.id) return;
                              const jobRef = doc(db, "job_offers", j.id);
                              const nextState = j.active === false ? true : false;
                              await updateDoc(jobRef, { active: nextState });
                              setJobOffers(jobOffers.map(o => o.id === j.id ? { ...o, active: nextState } : o));
                              toast.success(`Job status changed to: ${nextState ? "Active" : "Paused"}`);
                            } catch (e: any) {
                              toast.error(e.message);
                            }
                          }}
                          className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                            j.active !== false 
                              ? "bg-green-50 text-green-750 hover:bg-green-100" 
                              : "bg-red-50 text-red-750 hover:bg-red-100"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${j.active !== false ? "bg-green-600" : "bg-red-500"}`}></span>
                          {j.active !== false ? "Recruiting" : "Paused / Draft"}
                        </button>
                      </td>
                      <td className="p-4 text-center font-sans">
                        <button
                          onClick={async () => {
                            if (!window.confirm("Are you sure you want to delete this career opportunity?")) return;
                            try {
                              if (!j.id) return;
                              await deleteDoc(doc(db, "job_offers", j.id));
                              setJobOffers(jobOffers.filter(o => o.id !== j.id));
                              toast.success("Job posting removed successfully!");
                            } catch (e: any) {
                              toast.error(e.message);
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Posting"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {jobApplications.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-gray-200 space-y-3">
              <Users size={32} className="text-gray-300 mx-auto" />
              <p className="text-sm font-black text-gray-700">No Candidate Leads Yet</p>
              <p className="text-xs text-gray-400 font-medium">
                When visitors submit documents for active openings, their records will pop up here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-3xl border border-gray-100 shadow-sm">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-xs text-gray-400 font-black uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Candidate & Contacts</th>
                      <th className="p-4">Target Role</th>
                      <th className="p-4">Submission Date</th>
                      <th className="p-4">Recruitment Status</th>
                      <th className="p-4 text-center">CV / Document File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium text-xs">
                    {jobApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <p className="font-black text-gray-900 text-sm">{app.applicantName}</p>
                            <p className="text-gray-400 font-semibold">{app.applicantEmail}</p>
                            <p className="text-gray-400 font-semibold">{app.applicantPhone}</p>
                          </div>
                        </td>
                        <td className="p-4 font-black text-gray-800 text-xs">
                          {app.jobTitle}
                        </td>
                        <td className="p-4 text-gray-400 font-semibold">
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : "Just Now"}
                        </td>
                        <td className="p-4">
                          <select
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-orange-600 transition-all cursor-pointer ${
                              app.status === "shortlisted" 
                                ? "bg-green-100 text-green-800" 
                                : app.status === "rejected" 
                                  ? "bg-red-100 text-red-800" 
                                  : app.status === "reviewed"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                            }`}
                            value={app.status || "pending"}
                            onChange={async (e) => {
                              try {
                                const selectVal = e.target.value;
                                const appRef = doc(db, "job_applications", app.id);
                                await updateDoc(appRef, { status: selectVal });
                                setJobApplications(jobApplications.map(p => p.id === app.id ? { ...p, status: selectVal as any } : p));
                                toast.success(`Application updated to: ${selectVal.toUpperCase()}`);
                              } catch (err: any) {
                                toast.error(err.message);
                              }
                            }}
                          >
                            <option value="pending">PENDING</option>
                            <option value="reviewed">REVIEWED</option>
                            <option value="shortlisted">SHORTLISTED</option>
                            <option value="rejected">REJECTED</option>
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                try {
                                  if (!app.resumeDetails) {
                                    toast.error("No CV document details found on database storage.");
                                    return;
                                  }
                                  let fileBlob: Blob;
                                  let filename = app.resumeName || `${app.applicantName.replace(/\s+/g, "_")}_Resume.pdf`;
                                  
                                  if (app.resumeDetails.startsWith("data:")) {
                                    const parts = app.resumeDetails.split(";base64,");
                                    const contentType = parts[0].split(":")[1];
                                    const raw = window.atob(parts[1]);
                                    const rawLength = raw.length;
                                    const uInt8Array = new Uint8Array(rawLength);
                                    for (let i = 0; i < rawLength; ++i) {
                                      uInt8Array[i] = raw.charCodeAt(i);
                                    }
                                    fileBlob = new Blob([uInt8Array], { type: contentType });
                                  } else {
                                    fileBlob = new Blob([app.resumeDetails], { type: "text/plain" });
                                  }
                                  
                                  const blobUrl = URL.createObjectURL(fileBlob);
                                  const link = document.createElement("a");
                                  link.href = blobUrl;
                                  link.download = filename;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  URL.revokeObjectURL(blobUrl);
                                  toast.success(`Downloaded candidate CV: ${filename}`);
                                } catch (e: any) {
                                  toast.error(`Error downloading resume file: ${e.message}`);
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer border-none"
                            >
                              <Download size={13} />
                              <span>Download CV</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default CareersTab;
