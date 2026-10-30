const cfg=window.CRM_CONFIG;const db=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);let user=null,profile=null,clients=[];const stages=['Potencial','Contactado','Entrevista agendada','Primera entrevista','Propuesta','Reserva','Venta','Perdido'];const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));stages.forEach(s=>$('filterStage').insertAdjacentHTML('beforeend','<option>'+s+'</option>'));
function authTab(which){const a=which==='activate';$('activateForm').classList.toggle('hidden',!a);$('loginForm').classList.toggle('hidden',a);$('tabActivate').classList.toggle('active',a);$('tabLogin').classList.toggle('active',!a);$('authMsg').textContent=''}$('tabLogin').onclick=()=>authTab('login');$('tabActivate').onclick=()=>authTab('activate');
$('activateForm').onsubmit=async e=>{e.preventDefault();const email=$('activateEmail').value.trim().toLowerCase(),p=$('activatePass').value,p2=$('activatePass2').value;$('authMsg').className='msg';if(p!==p2){$('authMsg').textContent='Las contraseñas no coinciden.';$('authMsg').classList.add('err');return}$('authMsg').textContent='Activando...';const {error}=await db.auth.signUp({email,password:p});if(error){$('authMsg').textContent='No se pudo activar. Verificá que el correo esté autorizado o que no tenga ya una cuenta.';$('authMsg').classList.add('err');return}$('authMsg').textContent='Cuenta creada. Revisá tu correo para confirmar el acceso y luego ingresá.';$('authMsg').classList.add('ok')};
$('loginForm').onsubmit=async e=>{e.preventDefault();$('authMsg').textContent='Ingresando...';const {data,error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPass').value});if(error){$('authMsg').textContent='No se pudo ingresar. Verificá email, contraseña y confirmación del correo.';$('authMsg').className='msg err';return}user=data.user;await loadProfile();await openCRM()};
async function loadProfile(){const {data,error}=await db.from('profiles').select('*').eq('id',user.id).single();if(error)throw error;profile=data}
async function openCRM(){$('authBox').classList.add('hidden');$('crm').classList.remove('hidden');$('logout').classList.remove('hidden');$('who').textContent=profile.full_name+' · '+(profile.role==='admin'?'Jefe Comercial':'Vendedor');if(profile.role==='admin'){$('adminBox').classList.remove('hidden');$('filterSeller').classList.remove('hidden');$('title').textContent='Clientes del equipo';$('subtitle').textContent='Vista gerencial completa, incluidos los registros sin asignar.'}await loadClients()}
async function loadClients(){const {data,error}=await db.from('clients').select('*,profiles(full_name)').order('lead_date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false});if(error){alert('No se pudieron cargar los clientes.');console.error(error);return}clients=data||[];
if(profile?.role==='admin'){
  const sel=$('filterSeller');
  const current=sel.value;
  const sellers=[...new Set(clients.map(c=>c.profiles?.full_name||c.legacy_owner_name||'Sin asignar'))]
    .sort((a,b)=>a.localeCompare(b,'es'));
  sel.innerHTML='<option value="">Todos los vendedores</option>'+sellers.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  if(sellers.includes(current)) sel.value=current;
}
$('filterStage').innerHTML='<option value="">Todas las etapas</option>'+['Potencial','Contactado','Entrevista agendada','Primera entrevista','Propuesta','Reserva','Venta','Perdido'].map(s=>`<option value="${s}">${s}</option>`).join('');render()}
function filtered(){
  const q=$('search').value.trim().toLowerCase(),
        st=$('filterStage').value,
        month=$('filterMonth').value,
        seller=$('filterSeller').value,
        kpi=$('filterKpi').value;
  return clients.filter(c=>{
    const sellerName=c.profiles?.full_name||c.legacy_owner_name||'Sin asignar';
    const kpiOk =
      !kpi ||
      (kpi==='interviews' && ['Entrevista agendada','Primera entrevista','Propuesta','Reserva','Venta'].includes(c.stage)) ||
      (kpi==='proposals' && ['Propuesta','Reserva','Venta'].includes(c.stage)) ||
      (kpi==='sales' && c.stage==='Venta');
    return (!st||c.stage===st)
      &&(!month||(c.lead_date||'').slice(0,7)===month)
      &&(!seller||sellerName===seller)
      &&kpiOk
      &&(!q||[c.name,c.phone,c.project,c.source,c.stage,c.notes,c.legacy_owner_name,sellerName]
        .some(v=>String(v||'').toLowerCase().includes(q)));
  })
}
function followClass(d){if(!d)return'';const today=new Date().toISOString().slice(0,10);return d<today?'overdue':d===today?'today':''}
function render(){const list=filtered();$('kLeads').textContent=list.length;$('kInterviews').textContent=list.filter(c=>['Entrevista agendada','Primera entrevista','Propuesta','Reserva','Venta'].includes(c.stage)).length;$('kProposals').textContent=list.filter(c=>['Propuesta','Reserva','Venta'].includes(c.stage)).length;$('kSales').textContent=list.filter(c=>c.stage==='Venta').length;$('rows').innerHTML=list.length?list.map(c=>`<tr><td><strong>${esc(c.name)}</strong><div class="muted">${esc(c.phone||'')}</div>${profile.role==='admin'?`<span class="badge">${esc(c.profiles?.full_name||c.legacy_owner_name||'Sin asignar')}</span>`:''}</td><td>${esc(c.project||'Sin datos')}</td><td>${esc(c.source||'')}</td><td><select class="st" data-id="${c.id}">${stages.map(s=>`<option ${s===c.stage?'selected':''}>${s}</option>`).join('')}</select></td><td>${esc(c.last_contact||'—')}</td><td class="${followClass(c.next_follow_up)}">${esc(c.next_follow_up||'—')}</td><td>${esc(c.notes||'—')}</td></tr>`).join(''):'<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Sin registros.</td></tr>';document.querySelectorAll('.st').forEach(x=>x.onchange=async e=>{const {error}=await db.from('clients').update({stage:e.target.value}).eq('id',e.target.dataset.id);if(error)alert('No se pudo actualizar');else await loadClients()});if(profile.role==='admin')summary()}
function summary(){const g={};filtered().forEach(c=>{const n=c.profiles?.full_name||c.legacy_owner_name||'Sin asignar';g[n]??={leads:0,interviews:0,proposals:0,sales:0};g[n].leads++;if(['Entrevista agendada','Primera entrevista','Propuesta','Reserva','Venta'].includes(c.stage))g[n].interviews++;if(['Propuesta','Reserva','Venta'].includes(c.stage))g[n].proposals++;if(c.stage==='Venta')g[n].sales++});$('teamSummary').innerHTML=Object.entries(g).sort((a,b)=>b[1].leads-a[1].leads).map(([n,d])=>`<div class="seller"><strong>${esc(n)}</strong><span>${d.leads} leads</span><span>${d.interviews} entrevistas+</span><span>${d.proposals} propuestas</span><span>${d.sales} ventas</span></div>`).join('')||'<div class="muted">Sin registros para el período seleccionado.</div>'}
$('clientForm').onsubmit=async e=>{e.preventDefault();$('saveMsg').textContent='Guardando...';const payload={owner_id:user.id,name:$('name').value.trim(),phone:$('phone').value.trim(),source:$('source').value,project:$('project').value,stage:$('stage').value,financing_type:$('financing').value,last_contact:$('lastContact').value||null,next_follow_up:$('nextFollow').value||null,lost_reason:$('lostReason').value.trim(),notes:$('notes').value.trim(),lead_date:new Date().toISOString().slice(0,10)};const {error}=await db.from('clients').insert(payload);if(error){$('saveMsg').textContent='No se pudo guardar.';$('saveMsg').className='msg err';return}e.target.reset();$('project').value='Sin datos';$('saveMsg').textContent='Cliente guardado.';$('saveMsg').className='msg ok';await loadClients()};$('search').oninput=render;$('filterStage').onchange=render;$('filterMonth').onchange=render;$('filterSeller').onchange=render;$('filterKpi').onchange=render;$('clearMonth').onclick=()=>{$('filterMonth').value='';render()};$('logout').onclick=async()=>{await db.auth.signOut();location.reload()};(async()=>{const {data}=await db.auth.getSession();if(data.session){user=data.session.user;try{await loadProfile();await openCRM()}catch(e){console.error(e);await db.auth.signOut()}}})();


function setQuickKpi(value){
  $('filterKpi').value=value;
  render();
}
if($('kpiInterviews')) $('kpiInterviews').onclick=()=>setQuickKpi('interviews');
if($('kpiProposals')) $('kpiProposals').onclick=()=>setQuickKpi('proposals');
if($('kpiSales')) $('kpiSales').onclick=()=>setQuickKpi('sales');
