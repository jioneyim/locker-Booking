import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  AlertCircle,
  Ban,
  CheckCircle,
  ClipboardPaste,
  Hash,
  Lock,
  LogOut,
  Settings,
  ShieldCheck,
  Trash2,
  Unlock,
  User,
  UserPlus,
  Users
} from "lucide-react";

import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch
} from "firebase/firestore";

import {
  auth,
  db
} from "./firebase";


/* =========================================================
   관리자 Firebase UID
========================================================= */

const ADMIN_UID =
  "5Ilq7bZIM1UjtvsWFSYhrO4fFq32";


/* =========================================================
   사물함 구조
========================================================= */

const ROWS = [
  "A",
  "B",
  "C",
  "D",
  "E"
];

const COLS = Array.from(
  { length: 18 },
  (_, i) => i + 1
);


export default function App() {


  /* =========================================================
     Firebase / 데이터
  ========================================================= */

  const [user, setUser] =
    useState(null);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [lockers, setLockers] =
    useState({});

  const [members, setMembers] =
    useState([]);

  const [settings, setSettings] =
    useState({
      isLocked: false,
      disabledSlots: []
    });



  /* =========================================================
     인증 전환 상태

     관리자 → 로그아웃 → 익명 로그인 사이에
     Firestore permission 오류가 순간적으로 발생하는 것을 방지
  ========================================================= */

  const authTransitionRef =
    useRef(false);



  /* =========================================================
     학생
  ========================================================= */

  const [studentId, setStudentId] =
    useState("");

  const [userName, setUserName] =
    useState("");

  const [
    studentAuthenticated,
    setStudentAuthenticated
  ] = useState(false);



  /* =========================================================
     공통 화면
  ========================================================= */

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [toast, setToast] =
    useState(null);

  const [
    confirmModal,
    setConfirmModal
  ] = useState(null);



  /* =========================================================
     관리자
  ========================================================= */

  const [
    showAdminPanel,
    setShowAdminPanel
  ] = useState(false);

  const [
    adminEmail,
    setAdminEmail
  ] = useState("");

  const [
    adminPassword,
    setAdminPassword
  ] = useState("");

  const [
    adminStudentId,
    setAdminStudentId
  ] = useState("");

  const [
    adminStudentName,
    setAdminStudentName
  ] = useState("");

  const [
    bulkMembers,
    setBulkMembers
  ] = useState("");

  const [
    adminMode,
    setAdminMode
  ] = useState("normal");



  /* =========================================================
     Toast
  ========================================================= */

  const showToast =
    useCallback(
      (
        message,
        type = "info"
      ) => {

        setToast({
          message,
          type
        });

        window.setTimeout(
          () => {
            setToast(null);
          },
          3000
        );

      },
      []
    );



  /* =========================================================
     Firebase Authentication

     일반 사용자
     → Anonymous

     관리자
     → Email / Password

     로그아웃
     → 자동으로 다시 Anonymous
  ========================================================= */

  useEffect(() => {

    let cancelled = false;


    const unsubscribe =
      onAuthStateChanged(
        auth,
        async firebaseUser => {

          if (cancelled) {
            return;
          }


          /*
            현재 로그인 사용자 없음

            관리자 로그아웃 직후에도 여기로 들어옴.
            Firestore listener를 먼저 종료시키고
            익명 로그인을 다시 수행.
          */

          if (!firebaseUser) {

            authTransitionRef.current =
              true;

            setUser(null);

            setIsAdmin(false);

            try {

              await signInAnonymously(
                auth
              );

            } catch (err) {

              if (cancelled) {
                return;
              }

              console.error(
                "Anonymous authentication error:",
                err
              );

              authTransitionRef.current =
                false;

              setError(
                "Firebase 인증에 실패했습니다."
              );

              setLoading(false);
            }

            return;
          }


          /*
            로그인 완료
          */

          authTransitionRef.current =
            false;

          setError("");

          setUser(
            firebaseUser
          );

          setIsAdmin(
            firebaseUser.uid ===
            ADMIN_UID
          );

        }
      );


    return () => {

      cancelled = true;

      unsubscribe();

    };

  }, []);



  /* =========================================================
     Firestore 데이터 실시간 읽기
  ========================================================= */

  useEffect(() => {

    if (!user) {
      return;
    }


    let lockersLoaded = false;

    let membersLoaded = false;

    let settingsLoaded = false;


    const checkLoading = () => {

      if (
        lockersLoaded &&
        membersLoaded &&
        settingsLoaded
      ) {

        setLoading(false);

      }

    };


    /*
      인증 계정 전환 중 발생한
      permission-denied는 무시
    */

    const handleFirestoreError =
      (
        label,
        message,
        err
      ) => {

        console.error(
          `${label}:`,
          err
        );


        if (
          authTransitionRef.current &&
          err?.code ===
            "permission-denied"
        ) {

          console.warn(
            "인증 전환 중 발생한 권한 오류이므로 무시합니다."
          );

          return;
        }


        setError(
          message
        );

        setLoading(false);

      };



    /* ---------------------------------------------------------
       lockers
    --------------------------------------------------------- */

    const unsubscribeLockers =
      onSnapshot(

        collection(
          db,
          "lockers"
        ),

        snapshot => {

          const result = {};


          snapshot.forEach(
            document => {

              result[
                document.id
              ] =
                document.data();

            }
          );


          setLockers(
            result
          );


          lockersLoaded =
            true;

          checkLoading();

        },

        err => {

          handleFirestoreError(
            "lockers error",
            "사물함 데이터를 읽지 못했습니다.",
            err
          );

        }

      );



    /* ---------------------------------------------------------
       members
    --------------------------------------------------------- */

    const unsubscribeMembers =
      onSnapshot(

        collection(
          db,
          "members"
        ),

        snapshot => {

          const result = [];


          snapshot.forEach(
            document => {

              const data =
                document.data();


              result.push({

                studentId:
                  document.id,

                name:
                  data.name ?? ""

              });

            }
          );


          result.sort(
            (a, b) =>
              a.studentId.localeCompare(
                b.studentId
              )
          );


          setMembers(
            result
          );


          membersLoaded =
            true;

          checkLoading();

        },

        err => {

          handleFirestoreError(
            "members error",
            "학생 명단을 읽지 못했습니다.",
            err
          );

        }

      );



    /* ---------------------------------------------------------
       settings/system
    --------------------------------------------------------- */

    const unsubscribeSettings =
      onSnapshot(

        doc(
          db,
          "settings",
          "system"
        ),

        snapshot => {

          if (
            snapshot.exists()
          ) {

            const data =
              snapshot.data();


            setSettings({

              isLocked:
                data.isLocked ??
                false,

              disabledSlots:
                Array.isArray(
                  data.disabledSlots
                )
                  ? data.disabledSlots
                  : []

            });

          } else {

            setSettings({

              isLocked: false,

              disabledSlots: []

            });

          }


          settingsLoaded =
            true;

          checkLoading();

        },

        err => {

          handleFirestoreError(
            "settings error",
            "시스템 설정을 읽지 못했습니다.",
            err
          );

        }

      );


    return () => {

      unsubscribeLockers();

      unsubscribeMembers();

      unsubscribeSettings();

    };

  }, [user]);



  /* =========================================================
     학생 명단 확인
  ========================================================= */

  const checkStudent =
    useCallback(
      () => {

        const id =
          studentId.trim();

        const name =
          userName.trim();


        return members.some(

          member =>

            member.studentId ===
              id

            &&

            member.name ===
              name

        );

      },
      [
        studentId,
        userName,
        members
      ]
    );



  /* =========================================================
     현재 학생의 사물함인지 확인
  ========================================================= */

  const isMyLocker =
    useCallback(
      locker => {

        if (
          !locker ||
          !studentAuthenticated
        ) {

          return false;

        }


        return (

          locker.studentId ===
            studentId.trim()

          &&

          locker.name ===
            userName.trim()

        );

      },
      [
        studentId,
        userName,
        studentAuthenticated
      ]
    );



  /* =========================================================
     학생 인증
  ========================================================= */

  function authenticateStudent() {

    if (
      !studentId.trim() ||
      !userName.trim()
    ) {

      showToast(
        "학번과 이름을 입력해주세요.",
        "error"
      );

      return;
    }


    if (
      !checkStudent()
    ) {

      setStudentAuthenticated(
        false
      );

      showToast(
        "등록되지 않은 학생입니다.",
        "error"
      );

      return;
    }


    setStudentAuthenticated(
      true
    );


    showToast(
      "인증되었습니다. 사물함을 선택하세요.",
      "success"
    );

  }



  /* =========================================================
     관리자 로그인
  ========================================================= */

  async function adminLogin() {

    if (
      !adminEmail.trim() ||
      !adminPassword
    ) {

      showToast(
        "관리자 이메일과 비밀번호를 입력해주세요.",
        "error"
      );

      return;
    }


    try {

      /*
        기존 익명 Firestore listener를 먼저 정리
      */

      authTransitionRef.current =
        true;

      setLoading(true);

      setError("");

      setUser(null);


      const result =
        await signInWithEmailAndPassword(
          auth,
          adminEmail.trim(),
          adminPassword
        );


      /*
        이메일/비밀번호가 맞아도
        지정된 UID가 아니라면 관리자 아님
      */

      if (
        result.user.uid !==
        ADMIN_UID
      ) {

        await signOut(
          auth
        );


        showToast(
          "관리자 계정이 아닙니다.",
          "error"
        );

        return;
      }


      setAdminEmail("");

      setAdminPassword("");


      showToast(
        "관리자 인증 완료",
        "success"
      );


    } catch (err) {

      console.error(
        "관리자 로그인 오류:",
        err
      );


      authTransitionRef.current =
        false;


      /*
        로그인 실패 시 기존 익명 계정이
        아직 살아있다면 다시 연결
      */

      if (
        auth.currentUser
      ) {

        setUser(
          auth.currentUser
        );

      } else {

        try {

          await signInAnonymously(
            auth
          );

        } catch (
          anonymousError
        ) {

          console.error(
            anonymousError
          );

        }

      }


      setLoading(false);


      showToast(
        "관리자 이메일 또는 비밀번호가 올바르지 않습니다.",
        "error"
      );

    }

  }



  /* =========================================================
     관리자 로그아웃

     핵심:
     여기서 직접 signInAnonymously 하지 않음.

     signOut 후 onAuthStateChanged가
     알아서 익명 로그인 수행.
  ========================================================= */

  async function adminLogout() {

    try {

      authTransitionRef.current =
        true;

      setLoading(true);

      setError("");

      setUser(null);

      setIsAdmin(false);

      setAdminMode(
        "normal"
      );


      await signOut(
        auth
      );


      showToast(
        "관리자 로그아웃 완료",
        "success"
      );


    } catch (err) {

      console.error(
        "관리자 로그아웃 오류:",
        err
      );


      authTransitionRef.current =
        false;

      setLoading(false);


      showToast(
        "로그아웃에 실패했습니다.",
        "error"
      );

    }

  }



  /* =========================================================
     사물함 클릭
  ========================================================= */

  async function handleLockerClick(
    lockerId
  ) {


    /* ---------------------------------------------------------
       관리자 차단 모드
    --------------------------------------------------------- */

    if (
      isAdmin &&
      adminMode ===
        "block"
    ) {

      try {

        const current =
          settings.disabledSlots;


        const updated =
          current.includes(
            lockerId
          )

            ? current.filter(
                id =>
                  id !==
                  lockerId
              )

            : [
                ...current,
                lockerId
              ];


        await setDoc(

          doc(
            db,
            "settings",
            "system"
          ),

          {
            disabledSlots:
              updated
          },

          {
            merge: true
          }

        );


        showToast(
          current.includes(
            lockerId
          )
            ? `${lockerId} 차단 해제`
            : `${lockerId} 사용 차단`,
          "success"
        );


      } catch (err) {

        console.error(
          err
        );


        showToast(
          "차단 설정 실패",
          "error"
        );

      }


      return;
    }



    const locker =
      lockers[
        lockerId
      ];


    const mine =
      isMyLocker(
        locker
      );



    /* ---------------------------------------------------------
       시스템 잠금
    --------------------------------------------------------- */

    if (
      settings.isLocked &&
      !isAdmin
    ) {

      showToast(
        "현재 예약 시스템이 잠겨 있습니다.",
        "error"
      );

      return;
    }



    /* ---------------------------------------------------------
       이미 예약된 자리
    --------------------------------------------------------- */

    if (locker) {

      if (
        mine ||
        isAdmin
      ) {

        setConfirmModal({

          title:
            isAdmin &&
            !mine
              ? "관리자 강제 취소"
              : "예약 취소",

          message:
            isAdmin &&
            !mine

              ? `${locker.studentId} ${locker.name} 학생의 예약을 삭제하시겠습니까?`

              : `${lockerId} 예약을 취소하시겠습니까?`,

          action:
            async () => {

              try {

                await deleteDoc(

                  doc(
                    db,
                    "lockers",
                    lockerId
                  )

                );


                showToast(
                  "예약이 취소되었습니다.",
                  "success"
                );


              } catch (err) {

                console.error(
                  err
                );


                showToast(
                  "예약 취소 실패",
                  "error"
                );

              }


              setConfirmModal(
                null
              );

            }

        });


      } else {

        showToast(
          "이미 예약된 사물함입니다.",
          "error"
        );

      }


      return;
    }



    /* ---------------------------------------------------------
       차단 자리
    --------------------------------------------------------- */

    if (
      settings.disabledSlots.includes(
        lockerId
      )
    ) {

      showToast(
        "사용할 수 없는 사물함입니다.",
        "error"
      );

      return;
    }



    /* ---------------------------------------------------------
       학생 인증 여부
    --------------------------------------------------------- */

    if (
      !studentAuthenticated
    ) {

      showToast(
        "학번과 이름을 먼저 인증해주세요.",
        "error"
      );

      return;
    }



    if (
      !checkStudent()
    ) {

      setStudentAuthenticated(
        false
      );


      showToast(
        "학생 인증 정보가 올바르지 않습니다.",
        "error"
      );

      return;
    }



    /* ---------------------------------------------------------
       한 명당 하나만 예약
    --------------------------------------------------------- */

    const alreadyReserved =
      Object.values(
        lockers
      ).some(

        lockerData =>

          lockerData.studentId ===
            studentId.trim()

      );


    if (
      alreadyReserved
    ) {

      showToast(
        "이미 예약한 사물함이 있습니다.",
        "error"
      );

      return;
    }



    /* ---------------------------------------------------------
       예약 생성
    --------------------------------------------------------- */

    try {

      await setDoc(

        doc(
          db,
          "lockers",
          lockerId
        ),

        {

          studentId:
            studentId.trim(),

          name:
            userName.trim(),

          uid:
            user.uid,

          timestamp:
            Date.now()

        }

      );


      showToast(
        `${lockerId} 예약 완료`,
        "success"
      );


    } catch (err) {

      console.error(
        "reservation error:",
        err
      );


      showToast(
        "예약에 실패했습니다.",
        "error"
      );

    }

  }



  /* =========================================================
     학생 입력 초기화
  ========================================================= */

  function resetStudent() {

    setStudentId("");

    setUserName("");

    setStudentAuthenticated(
      false
    );


    showToast(
      "학생 정보를 초기화했습니다."
    );

  }



  /* =========================================================
     학생 개별 추가
  ========================================================= */

  async function addMember() {

    if (
      !isAdmin
    ) {

      showToast(
        "관리자 권한이 필요합니다.",
        "error"
      );

      return;
    }


    const id =
      adminStudentId.trim();

    const name =
      adminStudentName.trim();


    if (
      !id ||
      !name
    ) {

      showToast(
        "학번과 이름을 입력해주세요.",
        "error"
      );

      return;
    }


    if (
      members.some(
        member =>
          member.studentId ===
          id
      )
    ) {

      showToast(
        "이미 등록된 학번입니다.",
        "error"
      );

      return;
    }


    try {

      await setDoc(

        doc(
          db,
          "members",
          id
        ),

        {
          name
        }

      );


      setAdminStudentId("");

      setAdminStudentName("");


      showToast(
        "학생을 추가했습니다.",
        "success"
      );


    } catch (err) {

      console.error(
        err
      );


      showToast(
        "학생 추가 실패",
        "error"
      );

    }

  }



  /* =========================================================
     학생 일괄 추가

     Google Sheets에서

     학번 | 이름

     두 열을 선택해서 그대로 복붙 가능.
  ========================================================= */

  async function addBulkMembers() {

    if (
      !isAdmin
    ) {

      showToast(
        "관리자 권한이 필요합니다.",
        "error"
      );

      return;
    }


    const raw =
      bulkMembers.trim();


    if (!raw) {

      showToast(
        "학생 명단을 붙여넣어 주세요.",
        "error"
      );

      return;
    }


    /*
      한 줄씩 분리
    */

    const lines =
      raw
        .split(/\r?\n/)
        .map(
          line =>
            line.trim()
        )
        .filter(Boolean);


    const parsed = [];


    for (
      const line
      of lines
    ) {

      /*
        Google Sheets 복사 시
        열 사이가 탭(\t)으로 들어옴.

        혹시 CSV 형태로 넣어도
        어느 정도 처리하도록 comma도 지원.
      */

      let parts =
        line.split("\t");


      if (
        parts.length < 2
      ) {

        parts =
          line.split(",");

      }


      if (
        parts.length < 2
      ) {

        continue;
      }


      const id =
        parts[0]
          .trim();

      const name =
        parts[1]
          .trim();


      /*
        첫 줄에
        "학번 이름"
        헤더가 포함된 경우 자동 무시
      */

      const normalizedId =
        id
          .replace(/\s/g, "")
          .toLowerCase();


      if (
        normalizedId ===
          "학번"

        ||

        normalizedId ===
          "studentid"

        ||

        normalizedId ===
          "student_id"
      ) {

        continue;
      }


      if (
        !id ||
        !name
      ) {

        continue;
      }


      parsed.push({
        id,
        name
      });

    }



    /*
      같은 학번이 여러 번 들어간 경우
      마지막 값만 사용
    */

    const uniqueMap =
      new Map();


    parsed.forEach(
      item => {

        uniqueMap.set(
          item.id,
          item
        );

      }
    );


    const uniqueMembers =
      Array.from(
        uniqueMap.values()
      );


    if (
      uniqueMembers.length ===
      0
    ) {

      showToast(
        "등록할 수 있는 학번/이름 데이터가 없습니다.",
        "error"
      );

      return;
    }


    try {

      /*
        Firestore batch는 한 번에
        너무 많은 write를 넣지 않도록
        400명씩 나눠 처리.
      */

      const CHUNK_SIZE =
        400;


      for (
        let i = 0;
        i <
        uniqueMembers.length;
        i += CHUNK_SIZE
      ) {

        const chunk =
          uniqueMembers.slice(
            i,
            i + CHUNK_SIZE
          );


        const batch =
          writeBatch(
            db
          );


        chunk.forEach(
          member => {

            batch.set(

              doc(
                db,
                "members",
                member.id
              ),

              {
                name:
                  member.name
              }

            );

          }
        );


        await batch.commit();

      }


      setBulkMembers("");


      showToast(
        `${uniqueMembers.length}명 일괄 등록 완료`,
        "success"
      );


    } catch (err) {

      console.error(
        "일괄 등록 오류:",
        err
      );


      showToast(
        "학생 명단 일괄 등록에 실패했습니다.",
        "error"
      );

    }

  }



  /* =========================================================
     학생 삭제
  ========================================================= */

  async function removeMember(
    studentIdToRemove
  ) {

    if (
      !isAdmin
    ) {

      showToast(
        "관리자 권한이 필요합니다.",
        "error"
      );

      return;
    }


    try {

      await deleteDoc(

        doc(
          db,
          "members",
          studentIdToRemove
        )

      );


      showToast(
        "학생을 삭제했습니다.",
        "success"
      );


    } catch (err) {

      console.error(
        err
      );


      showToast(
        "학생 삭제 실패",
        "error"
      );

    }

  }



  /* =========================================================
     시스템 잠금
  ========================================================= */

  async function toggleSystemLock() {

    if (
      !isAdmin
    ) {

      showToast(
        "관리자 권한이 필요합니다.",
        "error"
      );

      return;
    }


    try {

      await setDoc(

        doc(
          db,
          "settings",
          "system"
        ),

        {
          isLocked:
            !settings.isLocked
        },

        {
          merge: true
        }

      );


      showToast(
        settings.isLocked
          ? "예약 잠금을 해제했습니다."
          : "예약 시스템을 잠갔습니다.",
        "success"
      );


    } catch (err) {

      console.error(
        err
      );


      showToast(
        "시스템 설정 실패",
        "error"
      );

    }

  }



  /* =========================================================
     전체 예약 초기화
  ========================================================= */

  async function resetAllLockers() {

    if (
      !isAdmin
    ) {

      showToast(
        "관리자 권한이 필요합니다.",
        "error"
      );

      return;
    }


    if (
      !window.confirm(
        "모든 예약을 삭제합니다. 정말 진행할까요?"
      )
    ) {

      return;
    }


    try {

      const snapshot =
        await getDocs(

          collection(
            db,
            "lockers"
          )

        );


      const batch =
        writeBatch(
          db
        );


      snapshot.forEach(
        document => {

          batch.delete(
            document.ref
          );

        }
      );


      await batch.commit();


      showToast(
        "모든 예약을 삭제했습니다.",
        "success"
      );


    } catch (err) {

      console.error(
        err
      );


      showToast(
        "예약 초기화 실패",
        "error"
      );

    }

  }



  /* =========================================================
     Loading
  ========================================================= */

  if (loading) {

    return (

      <div
        className="
          center-page
          loading-text
        "
      >
        데이터 로딩 중...
      </div>

    );

  }



  /* =========================================================
     Error
  ========================================================= */

  if (error) {

    return (

      <div
        className="
          center-page
          error-text
        "
      >

        <AlertCircle />

        {error}

      </div>

    );

  }



  /* =========================================================
     UI
  ========================================================= */

  return (

    <div className="app">


      {/* =====================================================
          Toast
      ===================================================== */}

      {toast && (

        <div
          className={
            `toast ${toast.type}`
          }
        >

          {
            toast.type ===
            "error"

              ? (
                <AlertCircle
                  size={19}
                />
              )

              : (
                <CheckCircle
                  size={19}
                />
              )
          }

          {toast.message}

        </div>

      )}



      {/* =====================================================
          Confirm Modal
      ===================================================== */}

      {confirmModal && (

        <div className="modal-backdrop">

          <div className="modal">

            <h2>
              {
                confirmModal.title
              }
            </h2>

            <p>
              {
                confirmModal.message
              }
            </p>

            <div className="modal-buttons">

              <button
                className="secondary-button"
                onClick={() =>
                  setConfirmModal(
                    null
                  )
                }
              >
                취소
              </button>


              <button
                className="primary-button"
                onClick={
                  confirmModal.action
                }
              >
                확인
              </button>

            </div>

          </div>

        </div>

      )}



      {/* =====================================================
          Navbar
      ===================================================== */}

      <header className="navbar">

        <div className="brand">

          <div className="brand-icon">

            <ShieldCheck
              size={22}
            />

          </div>


          <strong>
            DS 사물함 예약 시스템
          </strong>


          {settings.isLocked && (

            <span className="locked-badge">
              변경 잠금됨
            </span>

          )}


          {isAdmin && (

            <span className="locked-badge">
              관리자
            </span>

          )}

        </div>



        <div className="nav-actions">

          <button
            className="student-reset-button"
            onClick={
              resetStudent
            }
          >

            <UserPlus
              size={15}
            />

            다른 학생으로 예약

          </button>


          <button
            className="icon-button"
            onClick={() =>
              setShowAdminPanel(
                !showAdminPanel
              )
            }
          >

            <Settings
              size={21}
            />

          </button>

        </div>

      </header>



      <main className="main-content">


        {/* ===================================================
            관리자 패널
        =================================================== */}

        {showAdminPanel && (

          <section className="admin-panel">

            <div className="admin-header">

              <div className="admin-title">

                <Lock
                  size={17}
                />

                ADMIN MODE

              </div>



              {!isAdmin ? (

                <div className="admin-login">

                  <input
                    type="email"
                    value={
                      adminEmail
                    }
                    onChange={
                      event =>
                        setAdminEmail(
                          event.target.value
                        )
                    }
                    placeholder="관리자 이메일"
                  />


                  <input
                    type="password"
                    value={
                      adminPassword
                    }
                    onChange={
                      event =>
                        setAdminPassword(
                          event.target.value
                        )
                    }
                    onKeyDown={
                      event => {

                        if (
                          event.key ===
                          "Enter"
                        ) {

                          adminLogin();

                        }

                      }
                    }
                    placeholder="비밀번호"
                  />


                  <button
                    onClick={
                      adminLogin
                    }
                  >
                    인증
                  </button>

                </div>

              ) : (

                <button
                  className="logout-button"
                  onClick={
                    adminLogout
                  }
                >

                  <LogOut
                    size={14}
                  />

                  Logout

                </button>

              )}

            </div>



            {isAdmin && (

              <div className="admin-grid">


                {/* ===========================================
                    학생 등록
                =========================================== */}

                <div className="admin-card">

                  <h3>

                    <UserPlus
                      size={16}
                    />

                    학생 명단 등록

                  </h3>


                  <input
                    value={
                      adminStudentId
                    }
                    onChange={
                      event =>
                        setAdminStudentId(
                          event.target.value
                        )
                    }
                    placeholder="학번"
                  />


                  <input
                    value={
                      adminStudentName
                    }
                    onChange={
                      event =>
                        setAdminStudentName(
                          event.target.value
                        )
                    }
                    placeholder="이름"
                  />


                  <button
                    className="admin-blue-button"
                    onClick={
                      addMember
                    }
                  >
                    개별 추가
                  </button>



                  {/* =========================================
                      Google Sheets 일괄 등록
                  ========================================= */}

                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "14px",
                      borderTop:
                        "1px solid #334155"
                    }}
                  >

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        color: "#93c5fd",
                        fontSize: "12px",
                        fontWeight: 800,
                        marginBottom: "8px"
                      }}
                    >

                      <ClipboardPaste
                        size={15}
                      />

                      Google Sheets 일괄 등록

                    </div>


                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: "10px",
                        lineHeight: 1.5,
                        margin:
                          "0 0 8px",
                        textAlign:
                          "center"
                      }}
                    >

                      학번과 이름 두 열을
                      Google Sheets에서 복사한 뒤
                      그대로 붙여넣으세요.

                    </p>


                    <textarea
                      value={
                        bulkMembers
                      }
                      onChange={
                        event =>
                          setBulkMembers(
                            event.target.value
                          )
                      }
                      placeholder={
`12230001	홍길동
12230002	김철수
12230003	이영희`
                      }
                      rows={8}
                      style={{
                        width: "100%",
                        resize:
                          "vertical",
                        padding: "10px",
                        borderRadius:
                          "10px",
                        background:
                          "#020617",
                        color: "white",
                        border:
                          "1px solid #334155",
                        outline:
                          "none",
                        fontSize:
                          "11px",
                        lineHeight:
                          1.6
                      }}
                    />


                    <button
                      className="admin-blue-button"
                      onClick={
                        addBulkMembers
                      }
                      style={{
                        width: "100%",
                        marginTop:
                          "8px"
                      }}
                    >
                      명단 일괄 등록
                    </button>

                  </div>

                </div>



                {/* ===========================================
                    등록 명단
                =========================================== */}

                <div className="admin-card">

                  <h3>

                    <Users
                      size={16}
                    />

                    등록 명단 (
                    {members.length}명)

                  </h3>


                  <div className="member-list">

                    {members.map(
                      member => (

                        <div
                          className="member-row"
                          key={
                            member.studentId
                          }
                        >

                          <span>

                            <span className="student-id">

                              {
                                member.studentId
                              }

                            </span>

                            {
                              member.name
                            }

                          </span>


                          <button
                            onClick={() =>
                              removeMember(
                                member.studentId
                              )
                            }
                          >

                            <Trash2
                              size={15}
                            />

                          </button>

                        </div>

                      )
                    )}

                  </div>

                </div>



                {/* ===========================================
                    시스템 제어
                =========================================== */}

                <div className="admin-card">

                  <h3>
                    시스템 제어
                  </h3>


                  <button
                    className={
                      settings.isLocked
                        ? "unlock-system-button"
                        : "lock-system-button"
                    }
                    onClick={
                      toggleSystemLock
                    }
                  >

                    {
                      settings.isLocked

                        ? (
                          <Unlock
                            size={17}
                          />
                        )

                        : (
                          <Lock
                            size={17}
                          />
                        )
                    }

                    {
                      settings.isLocked
                        ? "예약 잠금 해제"
                        : "예약 시스템 잠금"
                    }

                  </button>



                  <div className="mode-buttons">

                    <button
                      className={
                        adminMode ===
                        "normal"
                          ? "mode-active"
                          : ""
                      }
                      onClick={() =>
                        setAdminMode(
                          "normal"
                        )
                      }
                    >
                      예약 관리
                    </button>


                    <button
                      className={
                        adminMode ===
                        "block"
                          ? "block-active"
                          : ""
                      }
                      onClick={() =>
                        setAdminMode(
                          "block"
                        )
                      }
                    >
                      차단 모드
                    </button>

                  </div>


                  <button
                    className="reset-button"
                    onClick={
                      resetAllLockers
                    }
                  >
                    모든 예약 초기화
                  </button>

                </div>

              </div>

            )}

          </section>

        )}



        {/* ===================================================
            학생 인증
        =================================================== */}

        <section className="student-panel">

          <p>
            학번과 이름을 정확하게 입력한 후
            설정 완료를 눌러주세요.
          </p>


          <div className="student-form">

            <div className="input-wrapper">

              <Hash
                size={21}
              />

              <input
                value={
                  studentId
                }
                onChange={
                  event => {

                    setStudentId(
                      event.target.value
                    );

                    setStudentAuthenticated(
                      false
                    );

                  }
                }
                placeholder="학번"
              />

            </div>



            <div className="input-wrapper">

              <User
                size={21}
              />

              <input
                value={
                  userName
                }
                onChange={
                  event => {

                    setUserName(
                      event.target.value
                    );

                    setStudentAuthenticated(
                      false
                    );

                  }
                }
                placeholder="이름"
              />

            </div>



            <button
              className="student-submit"
              onClick={
                authenticateStudent
              }
            >
              설정 완료
            </button>

          </div>



          {studentAuthenticated && (

            <div className="auth-success">

              <CheckCircle
                size={17}
              />

              {studentId} {userName}
              {" "}
              인증 완료

            </div>

          )}

        </section>



        {/* ===================================================
            사물함
        =================================================== */}

        <section
          className={
            adminMode ===
              "block" &&
            isAdmin

              ? "locker-wrapper block-mode"

              : "locker-wrapper"
          }
        >

          <div className="locker-grid-container">


            {/* 열 번호 */}

            <div className="column-labels">

              <div className="row-placeholder" />

              {COLS.map(
                column => (

                  <div
                    className="column-label"
                    key={
                      column
                    }
                  >
                    {column}열
                  </div>

                )
              )}

            </div>



            {/* 사물함 행 */}

            {ROWS.map(
              row => (

                <div
                  className="locker-row"
                  key={
                    row
                  }
                >

                  <div className="row-label">
                    {row}
                  </div>



                  {COLS.map(
                    column => {

                      const lockerId =
                        `${row}${column}`;


                      const locker =
                        lockers[
                          lockerId
                        ];


                      const mine =
                        isMyLocker(
                          locker
                        );


                      const disabled =
                        settings.disabledSlots.includes(
                          lockerId
                        );


                      let className =
                        "locker-cell";


                      if (
                        disabled
                      ) {

                        className +=
                          " locker-disabled";

                      } else if (
                        mine
                      ) {

                        className +=
                          " locker-mine";

                      } else if (
                        locker
                      ) {

                        className +=
                          " locker-occupied";

                      } else {

                        className +=
                          " locker-empty";

                      }


                      return (

                        <button
                          key={
                            lockerId
                          }
                          className={
                            className
                          }
                          onClick={() =>
                            handleLockerClick(
                              lockerId
                            )
                          }
                        >

                          {disabled ? (

                            <>

                              <Ban
                                size={25}
                              />

                              <span>
                                사용 불가
                              </span>

                            </>

                          ) : mine ? (

                            <>

                              <CheckCircle
                                size={22}
                              />

                              <strong>
                                {
                                  locker.name
                                }
                              </strong>

                            </>

                          ) : locker ? (

                            <>

                              <Lock
                                size={19}
                              />

                              <strong>

                                {
                                  isAdmin

                                    ? locker.name

                                    : "예약 완료"
                                }

                              </strong>


                              {isAdmin && (

                                <small>

                                  {
                                    locker.studentId
                                  }

                                </small>

                              )}

                            </>

                          ) : (

                            <>

                              <Unlock
                                size={18}
                              />

                              <strong>
                                {
                                  lockerId
                                }
                              </strong>

                            </>

                          )}

                        </button>

                      );

                    }
                  )}

                </div>

              )
            )}

          </div>

        </section>



        {/* ===================================================
            범례
        =================================================== */}

        <div className="legend">

          <span>

            <i className="legend-empty" />

            빈 자리

          </span>


          <span>

            <i className="legend-mine" />

            내 사물함

          </span>


          <span>

            <i className="legend-occupied" />

            예약 완료

          </span>


          <span>

            <i className="legend-disabled" />

            사용 불가

          </span>

        </div>

      </main>

    </div>

  );

}
