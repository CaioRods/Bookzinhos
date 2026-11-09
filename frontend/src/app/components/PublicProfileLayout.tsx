import type {ReactNode,MouseEvent} from 'react';
import {Link,useLocation,useNavigate} from 'react-router';
import {LogIn} from 'lucide-react';
import {Brand} from './Brand';
import {ProfileBackButton} from './ProfileBackButton';

/** Public profiles permit reading; every interactive action hands off to login. */
export function PublicProfileLayout({children}:{children:ReactNode}){
 const location=useLocation(),navigate=useNavigate();
 const params=new URLSearchParams(location.search);params.set('auth','login');
 const login=`${location.pathname}?${params}${location.hash}`;
 const gate=(event:MouseEvent)=>{
  const target=event.target as HTMLElement;
  if(target.closest('[data-public-login], [data-public-back]'))return;
  if(target.closest('a,button,input,select,textarea,[role="button"]')){
   event.preventDefault();event.stopPropagation();navigate(login);
  }
 };
 return <div className="mb-public-profile" onClickCapture={gate} onAuxClickCapture={gate}>
  <header className="mb-public-profile-header">
   <div className="mb-public-profile-header-start">
    <ProfileBackButton />
    <Link to={login} data-public-login aria-label="myBooks — entrar"><Brand /></Link>
   </div>
   <Link to={login} data-public-login className="mb-btn mb-btn-primary"><LogIn size={18} />Logar</Link>
  </header>
  <main id="main-content" className="mb-public-profile-content">{children}</main>
  <footer className="mb-public-profile-footer"><p>Uma estante, muitas histórias. Entre para fazer parte.</p><Link to={login} data-public-login className="mb-btn mb-btn-outline">Entrar ou criar conta</Link></footer>
 </div>;
}
