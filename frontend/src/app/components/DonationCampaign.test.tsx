// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DonationCampaign,nextDonationDay} from './DonationCampaign';
vi.mock('./SupportDonation',()=>({SupportDonation:({onClose,onNeverShow}:{onClose:()=>void;onNeverShow:()=>void})=><div role="dialog"><button onClick={onClose}>Fechar doação</button><button onClick={onNeverShow}>Não mostrar novamente</button></div>}));
function App(){const navigate=useNavigate();return <><button onClick={()=>navigate('/read/1')}>Ler</button><button onClick={()=>navigate('/')}>Início</button><button onClick={()=>navigate('/library')}>Biblioteca</button><button onClick={()=>navigate('/donate')}>Causa</button><DonationCampaign/></>;}
const at=(day:number,hour=12,minute=0)=>new Date(2026,10,day,hour,minute);
beforeEach(()=>{localStorage.clear();vi.useFakeTimers();vi.setSystemTime(at(4));Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});});
afterEach(()=>{cleanup();vi.useRealTimers();});
const show=()=>render(<MemoryRouter><App/></MemoryRouter>);
const visible=()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});fireEvent(document,new Event('visibilitychange'));};
describe('donation on alternating calendar days',()=>{
 it('opens once today, skips tomorrow, and waits for navigation on the following day',()=>{
  show();fireEvent.click(screen.getByText('Fechar doação'));fireEvent.click(screen.getByText('Biblioteca'));expect(screen.queryByRole('dialog')).toBeNull();
  act(()=>vi.setSystemTime(at(5,23,59)));visible();expect(screen.queryByRole('dialog')).toBeNull();
  act(()=>vi.setSystemTime(at(6,0)));expect(screen.queryByRole('dialog')).toBeNull();fireEvent.click(screen.getByText('Início'));expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('remembers display through reloads, even without closing',()=>{
  const first=show();expect(screen.queryByRole('dialog')).not.toBeNull();first.unmount();let view=show();expect(screen.queryByRole('dialog')).toBeNull();view.unmount();
  act(()=>vi.setSystemTime(at(5,20)));view=show();expect(screen.queryByRole('dialog')).toBeNull();view.unmount();act(()=>vi.setSystemTime(at(6,9)));show();expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('uses calendar dates instead of 48 hours, including year boundaries',()=>{
  expect(nextDonationDay(at(4,23,59).getTime())).toBe(at(6,0).getTime());expect(nextDonationDay(new Date(2026,11,31,23).getTime())).toBe(new Date(2027,0,2,0).getTime());
 });
 it('does not extend the schedule when closed the next day',()=>{
  show();act(()=>vi.setSystemTime(at(5,10)));fireEvent.click(screen.getByText('Fechar doação'));act(()=>vi.setSystemTime(at(6,0)));visible();expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('migrates the old 30-minute schedule without immediately displaying again',()=>{
  localStorage.setItem('mybooks:donation:next-allowed:v1',String(at(4,12,30).getTime()));show();expect(screen.queryByRole('dialog')).toBeNull();act(()=>vi.setSystemTime(at(5,23,59)));visible();expect(screen.queryByRole('dialog')).toBeNull();act(()=>vi.setSystemTime(at(6,0)));visible();expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('does not interrupt reading or the donation page',()=>{
  render(<MemoryRouter initialEntries={['/read/1']}><App/></MemoryRouter>);expect(screen.queryByRole('dialog')).toBeNull();fireEvent.click(screen.getByText('Causa'));act(()=>vi.setSystemTime(at(6)));expect(screen.queryByRole('dialog')).toBeNull();fireEvent.click(screen.getByText('Início'));expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('waits for visibility and checks a schedule saved by another tab',()=>{
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});show();expect(screen.queryByRole('dialog')).toBeNull();localStorage.setItem('mybooks:donation:next-allowed:v2',String(at(6,0).getTime()));visible();expect(screen.queryByRole('dialog')).toBeNull();act(()=>vi.setSystemTime(at(6,9)));visible();expect(screen.queryByRole('dialog')).not.toBeNull();
 });
 it('preserves never-show-again through time and reloads',()=>{
  const view=show();fireEvent.click(screen.getByText('Não mostrar novamente'));act(()=>vi.setSystemTime(at(20)));fireEvent.click(screen.getByText('Biblioteca'));expect(screen.queryByRole('dialog')).toBeNull();view.unmount();show();expect(screen.queryByRole('dialog')).toBeNull();
 });
});
