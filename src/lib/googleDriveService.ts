import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// In-memory access token cache (never persisted in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function initGoogleDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

export async function signInWithGoogleDrive(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่สามารถรับสิทธิ์เข้าถึง Google Drive ได้ กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function getDriveAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export async function signOutGoogleDrive(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

export interface EvidenceItem {
  id: string;
  stepNumber: string;
  functionName: string;
  titleTh: string;
  descriptionTh: string;
  actorTested: string;
  fileName: string;
  imageUrl: string;
}

export const TEST_EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    id: 'fn-1',
    stepNumber: '01',
    functionName: 'createContract',
    titleTh: 'สร้างข้อตกลงการจ้างงาน (Create Contract)',
    descriptionTh:
      'ผู้ว่าจ้าง (0x3291...d15C) ระบุชื่อโครงการ รายละเอียด ค่าจ้าง 0.25 ETH กำหนดส่ง และ Address ของฟรีแลนซ์ (0xE052...0120)',
    actorTested: 'Client: 0x329160975fb8Ea2aeAfFBdFB605C780e00aDd15C',
    fileName: '01_create_contract.png',
    imageUrl: '/evidence/01_create_contract.png',
  },
  {
    id: 'fn-2',
    stepNumber: '02',
    functionName: 'depositPayment',
    titleTh: 'ฝากเงินค่าจ้างเข้า Escrow (Deposit Payment)',
    descriptionTh:
      'ผู้ว่าจ้างโอน ETH จำนวน 0.25 ETH ตรงตามข้อตกลงเข้าสู่ Smart Contract Escrow เพื่อใช้เป็นหลักประกัน',
    actorTested: 'Client: 0x329160975fb8Ea2aeAfFBdFB605C780e00aDd15C',
    fileName: '02_deposit_payment.png',
    imageUrl: '/evidence/02_deposit_payment.png',
  },
  {
    id: 'fn-3',
    stepNumber: '03',
    functionName: 'submitWork',
    titleTh: 'บันทึกการส่งมอบงาน (Submit Work)',
    descriptionTh:
      'ฟรีแลนซ์ (0xE052...0120) ส่งหลักฐาน URL ผลงานเข้าสู่สัญญา สถานะอัปเดตเป็น Submitted',
    actorTested: 'Freelancer: 0xE0529cB8578Fefa460Bb55e1EB91813B1F2b0120',
    fileName: '03_submit_work.png',
    imageUrl: '/evidence/03_submit_work.png',
  },
  {
    id: 'fn-4',
    stepNumber: '04',
    functionName: 'approveAndRelease',
    titleTh: 'อนุมัติและจ่ายเงิน (Approve & Release Payment)',
    descriptionTh:
      'ผู้ว่าจ้างตรวจรับงานและอนุมัติ ระบบโอน 0.25 ETH ให้ฟรีแลนซ์อัตโนมัติพร้อมล็อกสถานะป้องกันการจ่ายเงินซ้ำ',
    actorTested: 'Client: 0x329160975fb8Ea2aeAfFBdFB605C780e00aDd15C',
    fileName: '04_approve_and_release.png',
    imageUrl: '/evidence/04_approve_and_release.png',
  },
  {
    id: 'fn-5a',
    stepNumber: '05.1',
    functionName: 'raiseDispute',
    titleTh: 'แจ้งข้อพิพาท (Raise Dispute)',
    descriptionTh:
      'คู่สัญญาแจ้งข้อพิพาทบนสัญญา #2 ระบบระงับเงินไว้ใน Escrow ชั่วคราวจนกว่าผู้ดูแลระบบจะตัดสิน',
    actorTested: 'Client: 0x329160975fb8Ea2aeAfFBdFB605C780e00aDd15C',
    fileName: '05a_raise_dispute.png',
    imageUrl: '/evidence/05a_raise_dispute.png',
  },
  {
    id: 'fn-5b',
    stepNumber: '05.2',
    functionName: 'resolveDispute',
    titleTh: 'ผู้ดูแลระบบตัดสินข้อพิพาท (Resolve Dispute)',
    descriptionTh:
      'ผู้ดูแลระบบ (0x1444...D225) พิจารณาตัดสินคืนเงิน 0.15 ETH กลับไปยังผู้ว่าจ้าง (State: Refunded)',
    actorTested: 'Admin: 0x1444D0c117b02a728255F27d2DF68c87A796D225',
    fileName: '05b_resolve_dispute.png',
    imageUrl: '/evidence/05b_resolve_dispute.png',
  },
  {
    id: 'fn-6',
    stepNumber: '06',
    functionName: 'Transaction Tracking',
    titleTh: 'ติดตามสถานะธุรกรรม (Transaction Tracking)',
    descriptionTh:
      'หน้าประวัติธุรกรรมแสดง Event ครบทุกขั้นตอน (JobCreated, PaymentDeposited, WorkSubmitted, PaymentReleased, DisputeRaised, DisputeResolved)',
    actorTested: 'All Actors · Contract 0xA9150693a16Bd2A38eB14b57510D031b2395dAA0',
    fileName: '06_transaction_tracking.png',
    imageUrl: '/evidence/06_transaction_tracking.png',
  },
];

export interface DriveUploadedFile {
  id: string;
  name: string;
  webViewLink: string;
}

export async function createDriveFolder(
  accessToken: string,
  folderName: string
): Promise<DriveUploadedFile> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName.trim() || 'DigitalWork_Escrow_Test_Evidence',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ไม่สามารถสร้างโฟลเดอร์บน Google Drive ได้ (${res.status}): ${errText}`);
  }
  return (await res.json()) as DriveUploadedFile;
}

export async function uploadBlobToDriveFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  blob: Blob,
  mimeType: string
): Promise<DriveUploadedFile> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob, fileName);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`อัปโหลดไฟล์ ${fileName} ไม่สำเร็จ (${res.status}): ${errText}`);
  }
  return (await res.json()) as DriveUploadedFile;
}

export function buildTestReportText(): string {
  const lines = [
    'DigitalWork Solutions - Freelance Escrow & Smart Payment Platform',
    'Sepolia Smart Contract: 0xA9150693a16Bd2A38eB14b57510D031b2395dAA0',
    'Etherscan: https://sepolia.etherscan.io/address/0xA9150693a16Bd2A38eB14b57510D031b2395dAA0',
    '',
    'Tested Wallet Addresses:',
    '- Client:     0x329160975fb8Ea2aeAfFBdFB605C780e00aDd15C',
    '- Freelancer: 0xE0529cB8578Fefa460Bb55e1EB91813B1F2b0120',
    '- Admin:      0x1444D0c117b02a728255F27d2DF68c87A796D225',
    '',
    'Verified Functional Requirements:',
    ...TEST_EVIDENCE_ITEMS.map(
      (item) =>
        `[${item.stepNumber}] ${item.functionName} - ${item.titleTh}\n    Evidence: ${item.fileName}\n    Detail: ${item.descriptionTh}`
    ),
    '',
    `Generated at: ${new Date().toISOString()}`,
  ];
  return lines.join('\n');
}
