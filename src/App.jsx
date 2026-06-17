import { useCallback, useEffect, useMemo, useState } from "react";

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import {
  AlertCircle,
  Ban,
  CheckCircle,
  Hash,
  Lock,
  Settings,
  ShieldCheck,
  Trash2,
  Unlock,
  User,
  UserPlus,
} from "lucide-react";

const firebaseConfig = {
  apiKey: "AIzaSyCANVK_865365opkg7r-rWHEZsFLQ93zJ0",
  authDomain: "book-your-locker.firebaseapp.com",
  projectId: "book-your-locker",
  storageBucket: "book-your-locker.firebasestorage.app",
  messagingSenderId: "859305778315",
  appId: "1:859305778315:web:7defc0354ba246c1d5888e",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const APP_ID = "locker-system-ds-final";

const ROWS = ["A", "B", "C", "D", "E"];
const COLS = Array.from({ length: 18 }, (_, i) => i + 1);

const DEFAULT_CONFIG = {
  allowedMembers: [],
  disabledSlots: [],
  adminCode: "admin123",
  isSystemLocked: false,
};

function Toast({ toast }) {
  if (!toast) return null;

  const isError = toast.type === "error";
  const isSuccess = toast.type === "success";
  const IconComponent = isError ? AlertCircle : CheckCircle;

  return (
    <div
      className={`fixed top-6 left-1/2 z-[100] flex -translate-x-1/2 animate-bounce items-center gap-3 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-2xl ${
        isError ? "bg-red-600" : isSuccess ? "bg-green-600" : "bg-slate-800"
      }`}
    >
      <IconComponent className="h-5 w-5" />
      {toast.message}
    </div>
  );
}

function ConfirmModal({ confirmModal, onClose }) {
  if (!confirmModal) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 text-center backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl">
        <h3 className="mb-2 text-xl font-black">{confirmModal.title}</h3>
        <p className="mb-6 text-sm leading-relaxed text-slate-500">
          {confirmModal.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 py-3 font-bold"
          >
            취소
          </button>
          <button
            onClick={confirmModal.onConfirm}
            className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [lockers, setLockers] = useState({});
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const [studentId, setStudentId] = useState("");
  const [userName, setUserName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [adminNewStudentId, setAdminNewStudentId] = useState("");
  const [adminNewName, setAdminNewName] = useState("");
  const [newAdminCode, setNewAdminCode] = useState("");
  const [editMode, setEditMode] = useState("reserve");
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const trimmedStudentId = useMemo(() => studentId.trim(), [studentId]);
  const trimmedUserName = useMemo(() => userName.trim(), [userName]);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    let unsubscribeAuth = () => {};

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error(error);
        showToast("Firebase 익명 로그인 실패. 설정을 확인하세요.", "error");
        setLoading(false);
      }
    };

    initAuth();
    unsubscribeAuth = onAuthStateChanged(auth, setUser);

    return () => unsubscribeAuth();
  }, [showToast]);

  useEffect(() => {
    if (!user) return undefined;

    const lockerRef = collection(
      db,
      "artifacts",
      APP_ID,
      "public",
      "data",
      "lockers"
    );

    const configRef = collection(
      db,
      "artifacts",
      APP_ID,
      "public",
      "data",
      "config"
    );

    const unsubscribeLockers = onSnapshot(
      query(lockerRef),
      (snapshot) => {
        const lockerData = {};
        snapshot.forEach((lockerDoc) => {
          lockerData[lockerDoc.id] = lockerDoc.data();
        });
        setLockers(lockerData);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        showToast("사물함 데이터를 불러오지 못했습니다.", "error");
        setLoading(false);
      }
    );

    const unsubscribeConfig = onSnapshot(
      query(configRef),
      (snapshot) => {
        const nextConfig = { ...DEFAULT_CONFIG };

        snapshot.forEach((configDoc) => {
          const data = configDoc.data();

          if (configDoc.id === "members") {
            nextConfig.allowedMembers = Array.isArray(data.list) ? data.list : [];
          }

          if (configDoc.id === "disabled") {
            nextConfig.disabledSlots = Array.isArray(data.list) ? data.list : [];
          }

          if (configDoc.id === "admin") {
            nextConfig.adminCode = data.code || DEFAULT_CONFIG.adminCode;
          }

          if (configDoc.id === "system") {
            nextConfig.isSystemLocked = Boolean(data.isLocked);
          }
        });

        setConfig(nextConfig);
      },
      (error) => {
        console.error(error);
        showToast("설정 데이터를 불러오지 못했습니다.", "error");
      }
    );

    return () => {
      unsubscribeLockers();
      unsubscribeConfig();
    };
  }, [showToast, user]);

  const isMySlot = useCallback(
    (lockerData) => {
      if (!lockerData || !isLoggedIn) return false;

      return (
        lockerData.studentId === trimmedStudentId &&
        lockerData.name === trimmedUserName
      );
    },
    [isLoggedIn, trimmedStudentId, trimmedUserName]
  );

  const checkAuthorization = useCallback(() => {
    if (!trimmedStudentId || !trimmedUserName) return false;

    return config.allowedMembers.some(
      (member) =>
        member.studentId === trimmedStudentId && member.name === trimmedUserName
    );
  }, [config.allowedMembers, trimmedStudentId, trimmedUserName]);

  const resetStudentSession = () => {
    setStudentId("");
    setUserName("");
    setIsLoggedIn(false);
    showToast("세션 초기화 완료");
  };

  const handleStudentLogin = () => {
    if (!trimmedStudentId || !trimmedUserName) {
      showToast("정보를 모두 입력해주세요.", "error");
      return;
    }

    if (checkAuthorization()) {
      setIsLoggedIn(true);
      showToast("인증 성공! 자리를 선택하세요.", "success");
      return;
    }

    setIsLoggedIn(false);
    showToast("등록되지 않은 명단입니다.", "error");
  };

  const handleAdminLogin = () => {
    if (adminInput === config.adminCode) {
      setIsAdmin(true);
      setAdminInput("");
      showToast("관리자 로그인 성공", "success");
      return;
    }

    showToast("비밀번호가 일치하지 않습니다.", "error");
  };

  const handleSlotClick = async (slotId) => {
    if (isAdmin && editMode === "manage-slots") {
      const nextDisabledSlots = config.disabledSlots.includes(slotId)
        ? config.disabledSlots.filter((id) => id !== slotId)
        : [...config.disabledSlots, slotId];

      try {
        await setDoc(
          doc(db, "artifacts", APP_ID, "public", "data", "config", "disabled"),
          { list: nextDisabledSlots }
        );
      } catch (error) {
        console.error(error);
        showToast("칸 상태 변경 실패. 보안 규칙을 확인하세요.", "error");
      }

      return;
    }

    const locker = lockers[slotId];
    const isMine = isMySlot(locker);

    if (config.isSystemLocked && !isAdmin) {
      showToast("현재 예약 시스템이 잠겨 있어 수정할 수 없습니다.", "error");
      return;
    }

    if (locker && (isMine || isAdmin)) {
      setConfirmModal({
        title: isAdmin && !isMine ? "관리자 권한 삭제" : "예약 취소",
        message:
          isAdmin && !isMine
            ? `[${locker.studentId} ${locker.name}] 학생의 예약을 취소하시겠습니까?`
            : "본인의 예약을 취소하시겠습니까?",
        onConfirm: async () => {
          try {
            await deleteDoc(
              doc(db, "artifacts", APP_ID, "public", "data", "lockers", slotId)
            );
            showToast("취소되었습니다.");
          } catch (error) {
            console.error(error);
            showToast("삭제 실패. 보안 규칙을 확인하세요.", "error");
          }

          setConfirmModal(null);
        },
      });
      return;
    }

    if (locker || config.disabledSlots.includes(slotId)) return;

    if (!isLoggedIn) {
      showToast("학번과 이름을 입력하고 '설정 완료'를 눌러주세요.", "error");
      return;
    }

    if (!checkAuthorization()) {
      showToast("등록되지 않은 명단입니다.", "error");
      return;
    }

    const alreadyReserved = Object.values(lockers).some(
      (lockerData) => lockerData.studentId === trimmedStudentId
    );

    if (alreadyReserved) {
      showToast("이미 예약된 자리가 있습니다. 1인 1칸만 가능합니다.", "error");
      return;
    }

    try {
      await setDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "lockers", slotId),
        {
          studentId: trimmedStudentId,
          name: trimmedUserName,
          uid: user.uid,
          timestamp: Date.now(),
        }
      );

      showToast(`${slotId}번 예약 성공!`, "success");
    } catch (error) {
      console.error(error);
      showToast("예약 실패. 보안 규칙을 확인하세요.", "error");
    }
  };

  const toggleSystemLock = async () => {
    try {
      const nextStatus = !config.isSystemLocked;

      await setDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "config", "system"),
        { isLocked: nextStatus }
      );

      showToast(
        nextStatus ? "예약 시스템이 잠겼습니다." : "시스템 잠금이 해제되었습니다."
      );
    } catch (error) {
      console.error(error);
      showToast("설정 실패", "error");
    }
  };

  const changeAdminCode = async () => {
    const code = newAdminCode.trim();

    if (!code) {
      showToast("새 비밀번호를 입력하세요.", "error");
      return;
    }

    try {
      await setDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "config", "admin"),
        { code }
      );

      showToast("관리자 비밀번호가 변경되었습니다.");
      setNewAdminCode("");
    } catch (error) {
      console.error(error);
      showToast("변경 실패. 보안 규칙을 확인하세요.", "error");
    }
  };

  const addSingleMember = async () => {
    const newStudentId = adminNewStudentId.trim();
    const newName = adminNewName.trim();

    if (!newStudentId || !newName) {
      showToast("학번과 성함을 모두 입력하세요.", "error");
      return;
    }

    if (
      config.allowedMembers.some((member) => member.studentId === newStudentId)
    ) {
      showToast("이미 등록된 학번입니다.", "error");
      return;
    }

    try {
      const updatedList = [
        ...config.allowedMembers,
        { studentId: newStudentId, name: newName },
      ];

      await setDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "config", "members"),
        { list: updatedList }
      );

      setAdminNewStudentId("");
      setAdminNewName("");
      showToast("명단에 추가되었습니다.");
    } catch (error) {
      console.error(error);
      showToast("추가 실패", "error");
    }
  };

  const removeMember = async (studentIdToRemove) => {
    try {
      const updatedList = config.allowedMembers.filter(
        (member) => member.studentId !== studentIdToRemove
      );

      await setDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "config", "members"),
        { list: updatedList }
      );

      showToast("명단에서 삭제되었습니다.");
    } catch (error) {
      console.error(error);
      showToast("삭제 실패", "error");
    }
  };

  const resetAllReservations = async () => {
    const confirmed = window.confirm("모든 예약 데이터를 삭제합니까?");
    if (!confirmed) return;

    try {
      const snapshot = await getDocs(
        collection(db, "artifacts", APP_ID, "public", "data", "lockers")
      );

      const batch = writeBatch(db);
      snapshot.forEach((lockerDoc) => batch.delete(lockerDoc.ref));
      await batch.commit();

      showToast("전체 초기화 완료");
    } catch (error) {
      console.error(error);
      showToast("전체 초기화 실패", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center font-bold text-slate-400 animate-pulse">
        데이터 로딩 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Toast toast={toast} />
      <ConfirmModal
        confirmModal={confirmModal}
        onClose={() => setConfirmModal(null)}
      />

      <div className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-600 p-2 shadow-lg shadow-blue-200">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-black uppercase tracking-tighter">
            DS 사물함 예약 시스템
          </span>
          {config.isSystemLocked && (
            <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-600">
              Locked
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetStudentSession}
            className="flex items-center gap-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100"
          >
            <UserPlus className="h-3 w-3" />
            다른 학생 예약
          </button>
          <button
            onClick={() => setShowAdminPanel((prev) => !prev)}
            className="rounded-xl p-2.5 transition-colors hover:bg-slate-100"
            aria-label="관리자 설정 열기"
          >
            <Settings className="h-5 w-5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1700px] p-4 md:p-8">
        {showAdminPanel && (
          <div className="mb-10 rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl">
            <div className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-blue-400">
                <Lock className="h-4 w-4" />
                Admin Dashboard
              </h2>

              {!isAdmin ? (
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={adminInput}
                    onChange={(event) => setAdminInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleAdminLogin();
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleAdminLogin}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold transition-all active:scale-95"
                  >
                    로그인
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAdmin(false)}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-bold uppercase text-red-500"
                >
                  Admin Logout
                </button>
              )}
            </div>

            {isAdmin && (
              <div className="grid gap-8 md:grid-cols-3">
                <div className="rounded-[2rem] border border-slate-700 bg-slate-800 p-6">
                  <p className="mb-5 text-center text-[10px] font-black uppercase tracking-widest text-blue-300">
                    학생 개별 등록
                  </p>

                  <div className="mb-6 space-y-3">
                    <input
                      type="text"
                      placeholder="학번"
                      value={adminNewStudentId}
                      onChange={(event) =>
                        setAdminNewStudentId(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="성함"
                      value={adminNewName}
                      onChange={(event) => setAdminNewName(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={addSingleMember}
                      className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold transition-all hover:bg-blue-700"
                    >
                      명단에 추가
                    </button>
                  </div>

                  <div className="border-t border-slate-700 pt-5">
                    <p className="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-blue-300">
                      관리자 비번 변경
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="새 비번"
                        value={newAdminCode}
                        onChange={(event) =>
                          setNewAdminCode(event.target.value)
                        }
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                      />
                      <button
                        onClick={changeAdminCode}
                        className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-600"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-700 bg-slate-800 p-6">
                  <p className="mb-4 text-center text-[10px] font-black uppercase tracking-widest text-blue-300">
                    등록 명단 ({config.allowedMembers.length}명)
                  </p>

                  <div className="custom-scrollbar flex max-h-[300px] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/50 p-3 pr-1">
                    {config.allowedMembers.length === 0 && (
                      <p className="py-8 text-center text-xs font-bold text-slate-500">
                        아직 등록된 학생이 없습니다.
                      </p>
                    )}

                    {config.allowedMembers.map((member) => (
                      <div
                        key={member.studentId}
                        className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[10px] transition-colors hover:border-slate-600"
                      >
                        <span>
                          <span className="mr-2 font-mono text-slate-500">
                            {member.studentId}
                          </span>
                          {member.name}
                        </span>
                        <button
                          onClick={() => removeMember(member.studentId)}
                          className="rounded p-1.5 text-slate-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
                          aria-label={`${member.name} 삭제`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-[2rem] border border-slate-700 bg-slate-800 p-6">
                  <div>
                    <p className="mb-4 text-center text-[10px] font-black uppercase tracking-widest text-blue-300">
                      시스템 통제
                    </p>

                    <button
                      onClick={toggleSystemLock}
                      className={`mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black shadow-xl transition-all ${
                        config.isSystemLocked
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {config.isSystemLocked ? (
                        <Unlock className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      {config.isSystemLocked
                        ? "예약 잠금 해제"
                        : "시스템 전체 잠금"}
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditMode("reserve")}
                        className={`flex-1 rounded-xl py-3 text-[10px] font-black transition-all ${
                          editMode === "reserve"
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        예약/수정
                      </button>
                      <button
                        onClick={() => setEditMode("manage-slots")}
                        className={`flex-1 rounded-xl py-3 text-[10px] font-black transition-all ${
                          editMode === "manage-slots"
                            ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        칸 비활성화
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={resetAllReservations}
                    className="mt-6 w-full rounded-2xl border-2 border-red-500/20 py-3 text-[10px] font-black uppercase tracking-widest text-red-400 transition-all hover:bg-red-500 hover:text-white"
                  >
                    Reset Everything
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-10 rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-2xl ring-1 ring-slate-200/50 md:p-8">
          <p className="mb-4 block text-center text-[10px] font-black uppercase leading-none tracking-widest text-slate-400">
            학번과 이름을 정확히 입력하고 '설정 완료'를 눌러주세요
          </p>

          <div className="flex flex-col items-end gap-5 md:flex-row">
            <div className="grid w-full flex-1 grid-cols-1 gap-4 md:grid-cols-2">
              <div className="group relative">
                <Hash className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-blue-500" />
                <input
                  type="text"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  placeholder="학번 (예: 122XXXXX)"
                  className="h-16 w-full rounded-[1.25rem] border-2 border-transparent bg-slate-50 py-5 pl-14 pr-6 text-lg font-bold shadow-inner outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="group relative">
                <User className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-blue-500" />
                <input
                  type="text"
                  value={userName}
                  onChange={(event) => setUserName(event.target.value)}
                  placeholder="성함 (예: 홍길동)"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleStudentLogin();
                  }}
                  className="h-16 w-full rounded-[1.25rem] border-2 border-transparent bg-slate-50 py-5 pl-14 pr-6 text-lg font-bold shadow-inner outline-none transition-all focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              onClick={handleStudentLogin}
              className="h-16 w-full rounded-[1.25rem] bg-blue-600 px-12 py-5 text-lg font-black text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 md:w-auto"
            >
              설정 완료
            </button>
          </div>
        </div>

        <div
          className={`custom-scrollbar overflow-x-auto rounded-[3.5rem] border-[10px] bg-white p-6 shadow-2xl transition-all md:p-10 ${
            editMode === "manage-slots" ? "border-amber-400" : "border-white"
          }`}
        >
          <div className="mx-auto w-fit">
            <div className="mb-6 flex gap-2.5 pl-[70px]">
              {COLS.map((col) => (
                <div
                  key={col}
                  className="locker-cell flex items-center justify-center text-sm font-black text-slate-200"
                >
                  {col}열
                </div>
              ))}
            </div>

            {ROWS.map((row) => (
              <div key={row} className="mb-2.5 flex gap-2.5">
                <div className="mr-2.5 flex w-[60px] items-center justify-center rounded-3xl bg-blue-50/50 text-4xl font-black text-blue-600 shadow-inner">
                  {row}
                </div>

                {COLS.map((col) => {
                  const id = `${row}${col}`;
                  const locker = lockers[id];
                  const isMine = isMySlot(locker);
                  const isDisabled = config.disabledSlots.includes(id);
                  const isOccupied = Boolean(locker);

                  let buttonClass =
                    "bg-white border-slate-100 hover:border-blue-400 hover:shadow-2xl text-slate-200";

                  if (isDisabled) {
                    buttonClass =
                      "bg-red-50 border-red-100 text-red-200 cursor-not-allowed";
                  } else if (isMine) {
                    buttonClass =
                      "bg-blue-600 border-blue-700 text-white shadow-2xl scale-[0.97] z-10 mine-highlight";
                  } else if (isOccupied) {
                    buttonClass = "bg-slate-50 border-slate-100 text-slate-400";
                  }

                  return (
                    <button
                      key={id}
                      onClick={() => handleSlotClick(id)}
                      className={`locker-cell group relative flex flex-col items-center justify-center rounded-[1.5rem] border-2 transition-all ${buttonClass}`}
                    >
                      {isDisabled ? (
                        <Ban className="h-6 w-6 opacity-30" />
                      ) : isMine ? (
                        <>
                          <CheckCircle className="mb-1.5 h-6 w-6 text-white" />
                          <span className="w-full truncate px-2 text-[11px] font-black uppercase leading-none">
                            {locker.name}
                          </span>
                        </>
                      ) : isOccupied ? (
                        <>
                          <Lock
                            className={`mb-1 h-5 w-5 ${
                              isAdmin ? "text-blue-500" : "opacity-10"
                            }`}
                          />
                          <span className="w-full truncate px-1 text-center text-[10px] font-bold">
                            {isAdmin ? locker.name : "예약 완료"}
                          </span>

                          {isAdmin && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-white bg-red-600/90 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <span className="mb-0.5 w-full truncate text-center text-[8px] font-bold text-white">
                                {locker.studentId}
                              </span>
                              <span className="mb-1.5 w-full truncate text-center text-[10px] font-black text-white">
                                {locker.name}
                              </span>
                              <Trash2 className="h-5 w-5 text-white" />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <Unlock className="mb-1.5 h-5 w-5 opacity-5" />
                          <span className="text-[11px] font-black leading-none">
                            {id}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-10 text-[11px] font-black uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-lg border-2 border-slate-200 bg-white" />
            빈 자리
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-lg bg-blue-600 shadow-lg shadow-blue-100" />
            내 사물함
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-lg bg-slate-100" />
            예약 완료 (익명)
          </div>
        </div>
      </div>
    </div>
  );
}
