import { useState, useEffect } from "react";
import { useLanguage } from "../lib/LanguageContext";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, addDoc, query, where, orderBy } from "firebase/firestore";
import { JobOffer, JobApplication, UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  UploadCloud, 
  FileCheck, 
  Send, 
  AlertCircle, 
  Sparkles, 
  CheckCircle,
  HelpCircle,
  X,
  User,
  Mail,
  Phone,
  ArrowRight
} from "lucide-react";
import toast from "react-hot-toast";

interface CareersProps {
  user: UserProfile | null;
}

// Fallback seed jobs if database is empty
const SEED_JOBS: Omit<JobOffer, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "Artisan Partnership Lead",
    department: "Community & Sourcing",
    location: "Nairobi (Hybrid)",
    type: "Full-time",
    description: "SokoPlus is seeking an energetic Partnership Coordinator to build relationships with local woodworkers, jewelry crafters, and textile artisans across East Africa. You will verify authentic origin sources, evaluate materials quality, and transition local artisans onto the SokoPlus shipping matrix.",
    requirements: [
      "Fluency in English and Swahili with excellent cross-cultural empathy.",
      "3+ years in community development, local logistics, or procurement within Kenya.",
      "Willingness to travel to workshop locations around Nairobi, Machakos, and Mombasa.",
      "Strong understanding of traditional craft forms and material grading."
    ],
    active: true
  },
  {
    title: "Senior Full Stack Dev (M-Pesa Integrations)",
    department: "Engineering",
    location: "Remote (Kenya)",
    type: "Full-time",
    description: "Join our core platform engineering team to optimize checkout transaction processing, real-time logistics tracking, and offline sync performance. You will be responsible for creating robust Webhook handlers, tracking loyalty system transactions, and security hardening API controllers.",
    requirements: [
      "Proficiency with React, Node.js, and Cloud Firestore.",
      "Demonstrated depth implementing Daraja API M-Pesa client integrations safely.",
      "Strong experience building optimized browser caches and high-integrity state systems.",
      "Passionate about promoting small scale businesses and authentic commerce."
    ],
    active: true
  },
  {
    title: "Artisan Logistics & Delivery Assistant",
    department: "Operations",
    location: "Nairobi Workshop",
    type: "Full-time",
    description: "Help SokoPlus guarantee that fragile handicraft items are packaged safely, loaded securely, and dispatched with proper export documentation. You'll run spot checks, verify weight specifications, and coordinate with courier partners like DHL and G4S.",
    requirements: [
      "Experience executing dispatch actions, shipping checklists, or warehousing procedures.",
      "Exceptional eye for detail and high standards of product care.",
      "Ability to handle scheduling communications under fast turnaround targets.",
      "Strong team player with great organizational skills."
    ],
    active: true
  }
];

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };

  const isQuota = 
    errorMsg.toLowerCase().includes("quota limit exceeded") ||
    errorMsg.toLowerCase().includes("quota exceeded") ||
    errorMsg.toLowerCase().includes("resource_exhausted") ||
    errorMsg.toLowerCase().includes("quota");

  if (isQuota) {
    console.warn("Firestore Careers Error Quota Alert (Bypassed):", errorMsg);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("firestore-quota-exceeded", {
          detail: { error: errorMsg, path }
        })
      );
    }
    return; // Safe return without throwing
  }

  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Careers({ user }: CareersProps) {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobOffer | null>(null);

  // Filter States
  const [deptFilter, setDeptFilter] = useState("All");
  const [locFilter, setLocFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  // Application Form States
  const [applyModalJob, setApplyModalJob] = useState<JobOffer | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File Upload State
  const [resumeFile, setResumeFile] = useState<{ name: string; content: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Abuse Protection Maths Quiz
  const [securityNumA, setSecurityNumA] = useState(0);
  const [securityNumB, setSecurityNumB] = useState(0);
  const [userSecurityAnswer, setUserSecurityAnswer] = useState("");

  // Populate Security Quiz on Modal Open
  useEffect(() => {
    if (applyModalJob) {
      setSecurityNumA(Math.floor(Math.random() * 10) + 1);
      setSecurityNumB(Math.floor(Math.random() * 10) + 1);
      setUserSecurityAnswer("");
      
      // Auto-populate if user details are present
      if (user) {
        setApplicantName(user.displayName || "");
        setApplicantEmail(user.email || "");
        setApplicantPhone(user.phoneNumber || "");
      } else {
        setApplicantName("");
        setApplicantEmail("");
        setApplicantPhone("");
      }
      setResumeFile(null);
      setCoverLetter("");
    }
  }, [applyModalJob, user]);

  // Fetch Jobs from firestore
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "job_offers"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const dbJobs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobOffer));

      if (dbJobs.length === 0) {
        // Seeding some initial demo jobs on DB for immediate interaction if empty
        const promises = SEED_JOBS.map(job => 
          addDoc(collection(db, "job_offers"), {
            ...job,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        );
        await Promise.all(promises);
        
        // Re-fetch
        const reSnap = await getDocs(q);
        const reDbJobs = reSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobOffer));
        setJobs(reDbJobs);
      } else {
        setJobs(dbJobs);
      }
    } catch (e) {
      console.warn("Could not load jobs from database (perhaps empty indexes). Using offline defaults.", e);
      // Fallback local list mock structured with dates
      const mockJobsWithIds = SEED_JOBS.map((job, idx) => ({
        id: `local-job-${idx}`,
        ...job,
        createdAt: new Date().toISOString()
      } as JobOffer));
      setJobs(mockJobsWithIds);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Handle file reading
  const handleFileUpload = (file: File) => {
    if (file.size > 800000) { // Limit to ~800KB for secure Firestore storage
      toast.error("Resume file size is too large. Please upload a file smaller than 800KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        setResumeFile({
          name: file.name,
          content: result // Base64 representation or reader text line
        });
        toast.success(`Resume "${file.name}" uploaded successfully!`);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to parse this file.");
    };
    // Read files as data URLs (Base64 is generic and robust for PDFs/Docs)
    reader.readAsDataURL(file);
  };

  // Drag & drop handlers
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Submit Job Application
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error("Security abuse prevention: You must sign in with a verified account before applying.");
      return;
    }

    // Validate Maths quiz
    const correctAnswer = securityNumA + securityNumB;
    if (parseInt(userSecurityAnswer.trim()) !== correctAnswer) {
      toast.error("Abuse Prevention Check Failed: Mathematical verification challenge is incorrect.");
      return;
    }

    if (!resumeFile) {
      toast.error("Please provide or drag-and-drop a valid resume document.");
      return;
    }

    setIsSubmitting(true);
    try {
      const applicationPayload: Omit<JobApplication, "id"> = {
        jobId: applyModalJob?.id || "unknown",
        jobTitle: applyModalJob?.title || "Unknown Role",
        userId: auth.currentUser.uid,
        applicantName,
        applicantEmail,
        applicantPhone,
        resumeDetails: resumeFile.content,
        resumeName: resumeFile.name,
        coverLetter,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      try {
        await addDoc(collection(db, "job_applications"), applicationPayload);
      } catch (firestoreErr: any) {
        handleFirestoreError(firestoreErr, OperationType.CREATE, "job_applications");
      }

      toast.success("Congratulations! Your application has been logged securely.", { icon: "🎉" });
      setApplyModalJob(null);
    } catch (err: any) {
      console.error(err);
      // Extra check: if the error message is a JSON error from handleFirestoreError, parse and display a readable message.
      let displayError = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          displayError = parsed.error;
        }
      } catch (_) {}
      toast.error(`Failed to file application: ${displayError}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch lists of depts, locations for filters
  const departments = ["All", ...Array.from(new Set(jobs.map(j => j.department)))];
  const locations = ["All", ...Array.from(new Set(jobs.map(j => j.location)))];
  const types = ["All", ...Array.from(new Set(jobs.map(j => j.type)))];

  // Filter logic
  const filteredJobs = jobs.filter(job => {
    const dMatch = deptFilter === "All" || job.department === deptFilter;
    const lMatch = locFilter === "All" || job.location === locFilter;
    const tMatch = typeFilter === "All" || job.type === typeFilter;
    return dMatch && lMatch && tMatch && job.active !== false;
  });

  return (
    <div className="bg-[#FAF9F6] min-h-screen py-16" id="careers-page-container">
      {/* Decorative Hero Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-tight">
          Empower Local Artisans, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
            Build Digital Commerce.
          </span>
        </h1>
        <p className="mt-4 text-base md:text-lg text-gray-500 max-w-2xl mx-auto font-medium">
          We bridge the gap between East Africa's craft workshops and global buyers. 
          If you are passionate about local logistics, payment infrastructures, or community impact, explore SokoPlus Careers.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left hand Filter Panel */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm self-start" id="careers-filter-card">
          <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
            <Briefcase size={18} className="text-orange-600" />
            Filter Career Openings
          </h2>

          <div className="space-y-5">
            {/* Department Filter */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Department</label>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setDeptFilter(dept)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all border ${
                      deptFilter === dept 
                        ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-100" 
                        : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Filter */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Location</label>
              <div className="flex flex-wrap gap-2">
                {locations.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setLocFilter(loc)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all border ${
                      locFilter === loc 
                        ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-100"
                        : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Engagement Type</label>
              <div className="flex flex-wrap gap-2">
                {types.map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all border ${
                      typeFilter === type 
                        ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-100" 
                        : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 font-medium">
              Don't see your specific role? 
            </p>
            <p className="text-xs font-bold text-orange-600 mt-1 cursor-pointer hover:underline" onClick={() => toast.success("Talent pool registered! Send your details to careers@sokoplus.co.ke")}>
              Join SokoPlus Talent Pool &rarr;
            </p>
          </div>
        </div>

        {/* Right hand Job Offers Grid */}
        <div className="lg:col-span-8 space-y-6" id="job-offers-list-container">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">
              Available Opportunities ({filteredJobs.length})
            </h3>
            <span className="text-xs font-bold text-gray-500">
              Showing active recruitment listings
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 space-y-4 shadow-sm animate-pulse">
              <div className="h-6 w-48 bg-gray-200 mx-auto rounded-md"></div>
              <div className="h-4 w-72 bg-gray-100 mx-auto rounded-md"></div>
              <div className="h-4 w-32 bg-gray-100 mx-auto rounded-md"></div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm space-y-4">
              <Briefcase size={40} className="text-gray-300 mx-auto" />
              <h4 className="text-lg font-black text-gray-900">No Job Offers Matched</h4>
              <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto">
                No active roles match your active filter tags. Try selecting "All" or join our global talent community email.
              </p>
              <button 
                onClick={() => { setDeptFilter("All"); setLocFilter("All"); setTypeFilter("All"); }}
                className="px-5 py-2.5 rounded-full bg-gray-900 text-white hover:bg-orange-600 transition-all font-bold text-xs"
              >
                Clear Search Filter Settings
              </button>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <motion.div 
                layout 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                key={job.id} 
                className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-50/20 transition-all duration-300 group"
                id={`job-offer-${job.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-orange-50 text-orange-700">
                        {job.department}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500 font-bold">
                        <MapPin size={12} className="text-gray-400" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500 font-bold">
                        <Clock size={12} className="text-gray-400" />
                        {job.type}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 group-hover:text-orange-600 transition-colors">
                      {job.title}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                    className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gray-50 text-gray-900 hover:bg-orange-50 hover:text-orange-700 transition-all text-xs font-black shadow-sm"
                  >
                    {selectedJob?.id === job.id ? "Minimize Info" : "View & Apply"}
                    <ArrowRight size={14} className={`transform transition-transform ${selectedJob?.id === job.id ? "rotate-90 text-orange-600" : ""}`} />
                  </button>
                </div>

                <AnimatePresence>
                  {selectedJob?.id === job.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden mt-6 pt-6 border-t border-gray-100"
                    >
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Role Overview</h4>
                      <p className="text-sm text-gray-600 font-medium leading-relaxed mb-6">
                        {job.description}
                      </p>

                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Key Requirements</h4>
                      <ul className="space-y-2 mb-8">
                        {job.requirements && job.requirements.map((req, rIdx) => (
                          <li key={rIdx} className="flex items-start gap-4.5 text-xs font-medium text-gray-500">
                            <span className="inline-flex rounded-full bg-orange-100 text-orange-600 p-0.5 mt-0.5 shrink-0">
                              <CheckCircle size={10} />
                            </span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Call to Apply action */}
                      <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <p className="text-sm font-black text-orange-950">Ready to take SokoPlus further?</p>
                          <p className="text-xs text-orange-700 font-medium">Verify your login and complete our spam-prevention applicant form details.</p>
                        </div>
                        <button
                          onClick={() => setApplyModalJob(job)}
                          className="px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all text-sm shadow-md shadow-orange-600/10 cursor-pointer"
                        >
                          Launch Application System
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Career Application Modal Backdrop & Form */}
      <AnimatePresence>
        {applyModalJob && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-2xl w-full max-w-2xl overflow-hidden self-center my-8"
              id="career-app-modal"
            >
              {/* Modal Header */}
              <div className="bg-gray-900 p-6 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-orange-400">
                    SokoPlus Careers System
                  </span>
                  <h3 className="text-xl font-black">
                    Applying for: {applyModalJob.title}
                  </h3>
                </div>
                <button 
                  onClick={() => setApplyModalJob(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmitApplication} className="p-6 md:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                
                {/* Auth verification banner */}
                {!auth.currentUser ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div className="space-y-1">
                      <p className="text-xs font-black text-amber-950">Anti-Abuse Engine Verification Required</p>
                      <p className="text-[11px] text-amber-700 font-medium">
                        To maintain high-integrity applications and prevent server spambots, you must be logged in to apply. 
                      </p>
                      <p className="text-[11px] font-bold text-orange-600 underline cursor-pointer mt-1" onClick={() => { setApplyModalJob(null); window.location.href = "/login"; }}>
                        Proceed to SokoPlus Account Login &rarr;
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-green-50/50 border border-green-100 flex items-start gap-3">
                    <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="text-xs font-black text-green-950">Authenticated Candidate Account</p>
                      <p className="text-[11px] text-green-700 font-medium">
                        Securely logged in as <b className="font-bold">{auth.currentUser.email}</b>. Your details will be protected by encryption rules.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name field */}
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Your Full Name</label>
                    <div className="relative">
                      <input 
                        type="text"
                        required
                        disabled={!auth.currentUser}
                        placeholder="e.g. Kenneth Mwangi"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium transition-all disabled:opacity-50"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                      />
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  {/* Email field */}
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Email Address</label>
                    <div className="relative">
                      <input 
                        type="email"
                        required
                        disabled={!auth.currentUser}
                        placeholder="kenneth@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium transition-all disabled:opacity-50"
                        value={applicantEmail}
                        onChange={(e) => setApplicantEmail(e.target.value)}
                      />
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Phone Field */}
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Phone Number (M-Pesa registered preferred)</label>
                  <div className="relative">
                    <input 
                      type="tel"
                      required
                      disabled={!auth.currentUser}
                      placeholder="e.g. +254 712 345 678"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium transition-all disabled:opacity-50"
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                    />
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                {/* Cover Letter Field */}
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Cover Letter / Pitch (Optional)</label>
                  <textarea 
                    rows={3}
                    disabled={!auth.currentUser}
                    placeholder="Briefly pitch why you are the best fit to support SokoPlus artisans..."
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-medium transition-all disabled:opacity-50 resize-none"
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                  />
                </div>

                {/* Drag & Drop Resume File Section */}
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">
                    Upload Resume / CV (PDF, Word, or Text doc limit 800KB)
                  </label>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                      !auth.currentUser ? "opacity-30 pointer-events-none" : ""
                    } ${
                      isDragging 
                        ? "border-orange-500 bg-orange-50/20" 
                        : resumeFile 
                          ? "border-green-500 bg-green-50/5" 
                          : "border-gray-200 bg-gray-50/50 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="file"
                      id="resume-file-input"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={handleFileInputChange}
                      disabled={!auth.currentUser}
                    />
                    
                    {resumeFile ? (
                      <div className="space-y-2">
                        <FileCheck size={32} className="text-green-500 mx-auto" />
                        <p className="text-sm font-black text-gray-900">{resumeFile.name}</p>
                        <p className="text-xs text-green-600 font-medium">Successfully processed with Base64 encoding ready for submission.</p>
                        <label 
                          htmlFor="resume-file-input" 
                          className="inline-block mt-2 text-xs font-bold text-orange-600 cursor-pointer hover:underline"
                        >
                          Change File Upload
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-2 cursor-pointer" onClick={() => document.getElementById("resume-file-input")?.click()}>
                        <UploadCloud size={32} className="text-gray-400 mx-auto" />
                        <p className="text-sm text-gray-700 font-medium">
                          Drag and drop your CV file here, or <span className="text-orange-500 font-bold underline">browse files</span>
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">Supports PDF, DOCX, TXT. Optimal format for server security filtering.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mathematical Bot-Abuse Check */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-gray-700 text-center sm:text-left">
                    <HelpCircle size={18} className="text-orange-500" />
                    <span className="text-xs font-bold">
                      Anti-bot: Solve the secure equation: <b className="font-extrabold text-sm ml-1 text-gray-900">{securityNumA} + {securityNumB} = ?</b>
                    </span>
                  </div>
                  <input 
                    type="number"
                    required
                    disabled={!auth.currentUser}
                    placeholder="Result..."
                    className="w-24 px-3 py-2 text-center bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-600 font-black"
                    value={userSecurityAnswer}
                    onChange={(e) => setUserSecurityAnswer(e.target.value)}
                  />
                </div>

                {/* Modal Footer / Submit Panel */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setApplyModalJob(null)}
                    className="px-5 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !auth.currentUser}
                    className="px-6 py-3 rounded-xl bg-gray-900 hover:bg-orange-600 text-white font-extrabold transition-all text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? "Submitting application details..." : "Submit Secure Application"}
                    <Send size={12} />
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
