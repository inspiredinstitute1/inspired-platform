import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = {
 title:'InspirED Institute | English for Competitive Exams',
 description:'Free Video Lessons • Study Notes • PYQs • Mock Tests. Your learning journey starts here with InspirED Institute.',
 metadataBase:new URL('https://inspiredinstitute.in'),alternates:{canonical:'/'},robots:{index:true,follow:true},appleWebApp:{capable:true,title:'InspirED',statusBarStyle:'black-translucent'},icons:{icon:'/icons/icon-192.png',apple:'/icons/apple-touch-icon.png'}
};
export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#080807'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en" data-theme="dark" suppressHydrationWarning><head><link rel="manifest" href="/manifest.webmanifest"/><link rel="stylesheet" href="/style.css"/><link rel="stylesheet" href="/theme.css"/><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('inspired-theme')==='light'?'light':'dark'}catch(e){}"}}/></head><body>{children}</body></html>;
}
