import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import SEO from "../components/SEO";

export default function Blog() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchPosts() {
      const snap = await getDocs(query(collection(db, "blog"), orderBy("publishedAt", "desc")));
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchPosts();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-20 space-y-16">
      <SEO 
        title="Market Stories" 
        description="Explore stories from local Kenyan artisans, market trends, and the heart of Kenyan commerce on the Sokoplus blog."
      />
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black tracking-tight">Sokoplus Blog</h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto">Insights, trends, and stories from the heart of Kenyan commerce.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {posts.length > 0 ? posts.map(post => (
          <motion.article 
            whileHover={{ y: -5 }}
            key={post.id} 
            className="group cursor-pointer space-y-4"
          >
            <div className="aspect-[16/9] bg-gray-100 rounded-3xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all">
               {post.image ? (
                 <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ShoppingBag size={48} />
                 </div>
               )}
            </div>
            <div className="space-y-2">
               <div className="flex space-x-2">
                 {post.tags?.map((tag: string) => (
                   <span key={tag} className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{tag}</span>
                 ))}
               </div>
               <h2 className="text-2xl font-bold group-hover:text-orange-600 transition-colors">{post.title}</h2>
               <p className="text-gray-500 line-clamp-3 text-sm leading-relaxed">{post.content}</p>
               <div className="pt-4 flex items-center text-gray-900 font-bold group-hover:translate-x-2 transition-transform">
                 Read Story <ArrowRight className="ml-2" size={16} />
               </div>
            </div>
          </motion.article>
        )) : (
          <div className="col-span-full py-20 bg-gray-50 rounded-3xl text-center space-y-4">
             <div className="text-gray-300 flex justify-center"><ShoppingBag size={64} /></div>
             <p className="text-gray-500 font-medium italic">Our storytellers are hard at work. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
