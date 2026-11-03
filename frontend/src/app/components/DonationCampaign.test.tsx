// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DonationCampaign,DONATION_INTERVAL} from './DonationCampaign';
vi.mock('./SupportDonation',()=>({SupportDonation:({onClose,onNeverShow}:{onClose:()=>void;onNeverShow:()=>void})=><div role="dialog"><button onClick={onClose}>Fechar doação</button><button onClick={onNeverShow}>Não mostrar novamente</button></div>}));
function App(){const navigate=useNavigate();return <><button onClick={()=>navigate('/read/1')}>Ler</button><button onClick={()=>navigate('/')}>Início</button><button onClick={()=>navigate('/library')}>Biblioteca</button><button onClick={()=>navigate('/donate')}>Causa</button><DonationCampaign/></>;}
beforeEach(()=>{localStorage.clear();vi.useFakeTimers();Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});});
afterEach(()=>{cleanup();vi.useRealTimers();});
const show=()=>render(<MemoryRouter><App/></MemoryRouter>);
const visible=()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});fireEvent(document,new Event('visibilitychange'));};
describe('donation cooldown',()=>{
 it('uses a minimum interval of thirty minutes',()=>{expect(DONATION_INTERVAL).toBe(30*60*1000);});
 it('becomes eligible after thirty minutes but opens only on a later navigation',()=>{
  show();fireEvent.click(screen.getByText('Fechar doação'));
  act(()=>vi.advanceTimersByTime(30*60*1000-1));fireEvent.click(screen.getByText('Biblioteca'));expect(screen.queryByRole('dialog')).toBeNull();
  act(()=>vi.advanceTimersByTime(1));expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByText('Início'));expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('remembers the cooldown through reloads and other mounts',()=>{
  let view=show();fireEvent.click(screen.getByText('Fechar doação'));act(()=>vi.advanceTimersByTime(29*60*1000));view.unmount();
  view=show();expect(screen.queryByRole('dialog')).toBeNull();visible();expect(screen.queryByRole('dialog')).toBeNull();
  act(()=>vi.advanceTimersByTime(60*1000));expect(screen.queryByRole('dialog')).toBeNull();view.unmount();show();expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('starts the cooldown when shown, even if the page is reloaded without closing it',()=>{const view=show();expect(screen.queryByRole('dialog')).not.toBeNull();view.unmount();show();expect(screen.queryByRole('dialog')).toBeNull();});
 it('does not interrupt reading or the donation page',()=>{
  render(<MemoryRouter initialEntries={['/read/1']}><App/></MemoryRouter>);expect(screen.queryByRole('dialog')).toBeNull();fireEvent.click(screen.getByText('Causa'));act(()=>vi.advanceTimersByTime(DONATION_INTERVAL));expect(screen.queryByRole('dialog')).toBeNull();fireEvent.click(screen.getByText('Início'));expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('waits for visibility and honors the cooldown when returning to a tab',()=>{
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});show();expect(screen.queryByRole('dialog')).toBeNull();visible();expect(screen.queryByRole('dialog')).not.toBeNull();fireEvent.click(screen.getByText('Fechar doação'));visible();expect(screen.queryByRole('dialog')).toBeNull();act(()=>vi.advanceTimersByTime(DONATION_INTERVAL));expect(screen.queryByRole('dialog')).toBeNull();visible();expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('preserves never-show-again through time and reloads',()=>{const view=show();fireEvent.click(screen.getByText('Não mostrar novamente'));act(()=>vi.advanceTimersByTime(DONATION_INTERVAL*3));fireEvent.click(screen.getByText('Biblioteca'));expect(screen.queryByRole('dialog')).toBeNull();view.unmount();show();expect(screen.queryByRole('dialog')).toBeNull();});
});
