const API="/api";
let token=localStorage.getItem("token");
let username=localStorage.getItem("username");
const authArea=document.getElementById("authArea");
const authSection=document.getElementById("authSection");
const editorSection=document.getElementById("editorSection");
const myTablesSection=document.getElementById("myTablesSection");
const tableWrapper=document.getElementById("tableWrapper");
const tableNameInput=document.getElementById("tableName");
const tablesList=document.getElementById("tablesList");
let tableState={id:null,name:"Untitled",rows:3,cols:4,cells:{}};
document.getElementById("signupBtn").onclick=signup;
document.getElementById("loginBtn").onclick=login;
document.getElementById("addRow").onclick=()=>{tableState.rows++; renderTable();}
document.getElementById("delRow").onclick=()=>{if(tableState.rows>1)tableState.rows--; renderTable();}
document.getElementById("addCol").onclick=()=>{tableState.cols++; renderTable();}
document.getElementById("delCol").onclick=()=>{if(tableState.cols>1)tableState.cols--; renderTable();}
document.getElementById("saveTable").onclick=saveTable;
document.getElementById("exportCSV").onclick=exportCSV;
document.getElementById("exportJSON").onclick=exportJSON;
tableNameInput.oninput=e=>tableState.name=e.target.value;
function msg(m){alert(m);}
function colLabel(n){let s=""; n++; while(n){ s=String.fromCharCode(65+(n-1)%26)+s; n=Math.floor((n-1)/26);} return s;}
function A1(r,c){return colLabel(c)+(r+1);}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;");}
function showAuth(){
  if(token){
    authSection.classList.add("hidden");
    editorSection.classList.remove("hidden");
    myTablesSection.classList.remove("hidden");
    authArea.innerHTML=`Logged in as <b>${username}</b> <button onclick="logout()">Logout</button>`;
    loadMyTables(); renderTable();
  }else{
    authSection.classList.remove("hidden");
    editorSection.classList.add("hidden");
    myTablesSection.classList.add("hidden");
    authArea.innerHTML="";
  }
}
async function signup(){
  const u=document.getElementById("signupUser").value.trim();
  const p=document.getElementById("signupPass").value;
  let res=await fetch(API+"/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p})});
  let j=await res.json(); if(res.ok)setAuth(j); else msg(j.error);
}
async function login(){
  const u=document.getElementById("loginUser").value.trim();
  const p=document.getElementById("loginPass").value;
  let res=await fetch(API+"/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p})});
  let j=await res.json(); if(res.ok)setAuth(j); else msg(j.error);
}
function setAuth(j){token=j.token; username=j.username; localStorage.setItem("token",token); localStorage.setItem("username",username); showAuth();}
function logout(){token=null; username=null; localStorage.clear(); tableState={id:null,name:"Untitled",rows:3,cols:4,cells:{}}; showAuth();}
function evalCell(k,seen={}){
  try {
    let v = tableState.cells[k] || "";
    if(!v.startsWith("=")) {
      return !isNaN(v) && v !== "" ? Number(v) : v;
    }
    if(seen[k]) return "#CYCLE";
    seen[k] = 1;
    let expr = v.slice(1);
    expr = expr.replace(/[A-Z]+[0-9]+/g, (ref) => {
      let val = evalCell(ref, {...seen});
      if(val === "" || isNaN(val)) return "0";
      return val;
    });
    let result = math.evaluate(expr);
    if(typeof result === "number") {
      return Number(result.toFixed(4));
    }
    return result;
  } catch(error) {
    console.error("Formula error:", error);
    return "#ERR";
  }
}
function renderTable(){
  tableNameInput.value=tableState.name;
  let html="<table><thead><tr><th></th>";
  for(let c=0;c<tableState.cols;c++) html+=`<th>${colLabel(c)}</th>`; html+="</tr></thead><tbody>";
  for(let r=0;r<tableState.rows;r++){
    html+=`<tr><th>${r+1}</th>`;
    for(let c=0;c<tableState.cols;c++){
      let k=A1(r,c); let raw=tableState.cells[k]||""; let val=evalCell(k);
      html+=`<td contenteditable data-k="${k}" data-formula="${esc(raw)}">${esc(raw.startsWith("=")?val:raw)}</td>`;
    }
    html+="</tr>";
  }
  tableWrapper.innerHTML=html;
  tableWrapper.querySelectorAll("td").forEach(td=>{
    td.onfocus = () => { 
      if(td.dataset.formula.startsWith("=")) {
        td.textContent = td.dataset.formula;
      }
    };
    td.onkeydown = (e) => { 
      if(e.key === "Enter") {
        e.preventDefault();
        const value = td.textContent.trim();
        tableState.cells[td.dataset.k] = value;
        if(value.startsWith("=")) {
          const result = evalCell(td.dataset.k);
          td.textContent = result;
        }   
        renderTable();
        td.blur();
      } 
    };
    td.onblur = () => { 
      const value = td.textContent.trim();
      tableState.cells[td.dataset.k] = value;
      if(value.startsWith("=")) {
        const result = evalCell(td.dataset.k);
        td.textContent = result;
      }
      renderTable();
    };
  });
}
async function saveTable(){
  if(!token) return msg("Login first");
  let res=await fetch(API+"/tables",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(tableState)});
  let j=await res.json(); if(res.ok){tableState.id=j.id; msg("Saved"); loadMyTables();}else msg(j.error);
}
async function loadMyTables(){
  if(!token) return;
  let res=await fetch(API+"/tables",{headers:{"Authorization":"Bearer "+token}});
  let arr=await res.json(); tablesList.innerHTML="";
  arr.forEach(t=>{tablesList.innerHTML+=`<li><b>${esc(t.name)}</b> <button onclick="loadTable('${t.id}')">Load</button> <button onclick="delTable('${t.id}')">Del</button></li>`;});
}
async function loadTable(id){
  let res=await fetch(API+"/tables/"+id,{headers:{"Authorization":"Bearer "+token}});
  if(!res.ok) return msg("Load fail");
  tableState=await res.json(); renderTable();
}
async function delTable(id){
  if(!confirm("Delete?")) return;
  await fetch(API+"/tables/"+id,{method:"DELETE",headers:{"Authorization":"Bearer "+token}});
  if(tableState.id===id) tableState={id:null,name:"Untitled",rows:3,cols:4,cells:{}};
  loadMyTables(); renderTable();
}
function exportJSON(){ download(new Blob([JSON.stringify(tableState,null,2)],{type:"application/json"}),(tableState.name||"table")+".json"); }
function exportCSV(){
  let rows=[[""].concat([...Array(tableState.cols)].map((_,c)=>colLabel(c)))];
  for(let r=0;r<tableState.rows;r++){ let row=[r+1]; for(let c=0;c<tableState.cols;c++) row.push(tableState.cells[A1(r,c)]||""); rows.push(row); }
  let csv=rows.map(r=>r.map(v=>`"${(v+"").replace(/"/g,'""')}"`).join(",")).join("\n");
  download(new Blob([csv],{type:"text/csv"}),(tableState.name||"table")+".csv");
}
function download(blob,name){ let a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
showAuth();
renderTable();