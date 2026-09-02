'use strict';
/* PXL-URG-0037 — Purchase Request permission bridge.
 * Makes backend PR routes honor Manajemen Akun pr_roles while preserving legacy role access.
 * Reads the current user from DB on every PR request so permission changes do not depend on stale JWT claims.
 */
const express=require('express');
const db=require('./db');

const LEGACY_ROLES=new Set(['superadmin','manager','accounting','admin']);
const READ_PERMS=new Set(['maker_pr','approval_pr1','approval_pr2','purchasing','supplier_admin']);
const APPROVAL_PERMS=new Set(['approval_pr1','approval_pr2']);
const EDIT_PERMS=new Set(['maker_pr','approval_pr1','approval_pr2','purchasing']);
const TARGET='/api/purchase-requests';
const TARGET_ID='/api/purchase-requests/:id';

const role=v=>String(v||'').trim().toLowerCase();
const hasAny=(values,set)=>Array.isArray(values)&&values.some(v=>set.has(String(v||'').trim()));

async function currentAccount(req){
  const sessionUser=req.session?.user;
  if(!sessionUser) return null;
  try{
    const users=await db.getUsers();
    return users.find(u=>String(u.id)===String(sessionUser.id))||sessionUser;
  }catch(_){
    return sessionUser;
  }
}

function deny(res){return res.status(403).json({error:'Akses ditolak.'});}

async function canRead(req,res,next){
  const u=await currentAccount(req);
  if(!u) return res.status(401).json({error:'Unauthorized'});
  if(LEGACY_ROLES.has(role(u.role))||hasAny(u.pr_roles,READ_PERMS)) return next();
  return deny(res);
}

async function canCreate(req,res,next){
  const u=await currentAccount(req);
  if(!u) return res.status(401).json({error:'Unauthorized'});
  if(LEGACY_ROLES.has(role(u.role))||Array.isArray(u.pr_roles)&&u.pr_roles.includes('maker_pr')) return next();
  return deny(res);
}

async function canPatch(req,res,next){
  const u=await currentAccount(req);
  if(!u) return res.status(401).json({error:'Unauthorized'});
  if(LEGACY_ROLES.has(role(u.role))) return next();
  const roles=Array.isArray(u.pr_roles)?u.pr_roles:[];
  const status=String(req.body?.status||'').trim().toLowerCase();
  if(['approved','rejected'].includes(status)){
    if(hasAny(roles,APPROVAL_PERMS)) return next();
    return deny(res);
  }
  if(hasAny(roles,EDIT_PERMS)) return next();
  return deny(res);
}

function replaceLegacyGuard(handlers,guard){
  // Existing PR routes are registered as: requireRole(...PR_ROLES), businessHandler.
  // Replace only that first legacy guard; leave the business handler untouched.
  if(handlers.length>=2) return [guard,...handlers.slice(1)];
  return [guard,...handlers];
}

const originalGet=express.application.get;
const originalPost=express.application.post;
const originalPatch=express.application.patch;

express.application.get=function pxl0037Get(path,...handlers){
  if(path===TARGET) handlers=replaceLegacyGuard(handlers,canRead);
  return originalGet.call(this,path,...handlers);
};
express.application.post=function pxl0037Post(path,...handlers){
  if(path===TARGET) handlers=replaceLegacyGuard(handlers,canCreate);
  return originalPost.call(this,path,...handlers);
};
express.application.patch=function pxl0037Patch(path,...handlers){
  if(path===TARGET_ID) handlers=replaceLegacyGuard(handlers,canPatch);
  return originalPatch.call(this,path,...handlers);
};
