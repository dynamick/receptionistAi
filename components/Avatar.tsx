
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import { useGLTF, useAnimations, useFBX } from '@react-three/drei';
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

interface AvatarProps {
  modelUrl: string;
  isSpeaking: boolean;
  isRumbaCommanded: boolean;
  audioAmplitude: number;
}

const ANIMATION_URLS = {
  talking: 'https://storage.googleapis.com/ai-studio-bucket-696108077748-us-west1/services/receptionist-ai/public/animations/Talking.fbx',
  rumba: 'https://storage.googleapis.com/ai-studio-bucket-696108077748-us-west1/services/receptionist-ai/public/animations/rumba-dancing.fbx',
  idle: 'https://storage.googleapis.com/ai-studio-bucket-696108077748-us-west1/services/receptionist-ai/public/animations/standing-idle.fbx'
};

export const Avatar: React.FC<AvatarProps> = ({ modelUrl, isSpeaking, isRumbaCommanded, audioAmplitude }) => {
  const group = useRef<THREE.Group>(null);
  const [isRandomDancing, setIsRandomDancing] = useState(false);
  
  const { scene, animations: gltfAnimations } = useGLTF(modelUrl);
  const talkFbx = useFBX(ANIMATION_URLS.talking);
  const idleRumbaFbx = useFBX(ANIMATION_URLS.rumba);
  const idleStandingFbx = useFBX(ANIMATION_URLS.idle);

  const allAnimations = useMemo(() => {
    const clips: THREE.AnimationClip[] = [...gltfAnimations];
    const processFbx = (fbx: THREE.Group, prefix: string) => {
      if (!fbx) return;
      fbx.animations.forEach((clip, index) => {
        const newClip = clip.clone();
        newClip.name = `${prefix}_${index}`;
        newClip.tracks.forEach((track) => {
          track.name = track.name.replace(/mixamorig|MixamoRig/g, '');
        });
        clips.push(newClip);
      });
    };
    processFbx(idleRumbaFbx, 'fbx_idle_rumba');
    processFbx(idleStandingFbx, 'fbx_idle_standing');
    processFbx(talkFbx, 'fbx_talk');
    return clips;
  }, [gltfAnimations, idleRumbaFbx, idleStandingFbx, talkFbx]);

  const { actions } = useAnimations(allAnimations, group);
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  const bones = useMemo(() => {
    const b: { head?: THREE.Bone; leftBreast?: THREE.Bone; rightBreast?: THREE.Bone } = {};
    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const lowerName = child.name.toLowerCase();
        if (lowerName.includes('head')) b.head = child as THREE.Bone;
        if (lowerName.includes('leftbreast')) b.leftBreast = child as THREE.Bone;
        if (lowerName.includes('rightbreast')) b.rightBreast = child as THREE.Bone;
      }
    });
    return b;
  }, [scene]);

  useEffect(() => {
    let timeoutId: number;
    const scheduleNextDance = () => {
      const randomDelay = Math.random() * 20000 + 10000;
      timeoutId = window.setTimeout(() => {
        if (!isSpeaking && !isRumbaCommanded) {
          setIsRandomDancing(true);
          window.setTimeout(() => {
            setIsRandomDancing(false);
            scheduleNextDance();
          }, 7000);
        } else {
          scheduleNextDance();
        }
      }, randomDelay);
    };
    if (!isSpeaking && !isRumbaCommanded) scheduleNextDance();
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [isSpeaking, isRumbaCommanded]);

  useEffect(() => {
    if (!actions) return;
    const names = Object.keys(actions);
    const talkName = names.find(n => n.includes('fbx_talk'));
    const idleStandingName = names.find(n => n.includes('fbx_idle_standing'));
    const idleRumbaName = names.find(n => n.includes('fbx_idle_rumba'));
    
    let nextAction = names[0];
    
    // Priorità: Comando Diretto > Parlato > Ballo Casuale > Idle
    if (isRumbaCommanded) {
      nextAction = idleRumbaName || names[0];
    } else if (isSpeaking) {
      nextAction = talkName || names[0];
    } else if (isRandomDancing) {
      nextAction = idleRumbaName || idleStandingName || names[0];
    } else {
      nextAction = idleStandingName || names[0];
    }

    if (nextAction && nextAction !== currentAction) {
      const prev = currentAction ? actions[currentAction] : null;
      const next = actions[nextAction];
      if (next) {
        if (prev) prev.fadeOut(0.5);
        next.reset().fadeIn(0.5).play();
        setCurrentAction(nextAction);
      }
    }
  }, [isSpeaking, isRandomDancing, isRumbaCommanded, actions, currentAction]);

  useFrame((state) => {
    if (!scene) return;
    const t = state.clock.getElapsedTime();
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          const mouthOpenIdx = mesh.morphTargetDictionary['mouthOpen'] ?? mesh.morphTargetDictionary['jawOpen'];
          if (mouthOpenIdx !== undefined) {
            const target = isSpeaking ? audioAmplitude * 0.8 : 0;
            const current = mesh.morphTargetInfluences[mouthOpenIdx];
            const desired = Math.min(target, 0.45);
            mesh.morphTargetInfluences[mouthOpenIdx] = current + (desired - current) * 0.2;
          }
          const blink = Math.sin(t * 3.8) > 0.98 ? 1 : 0;
          ['eyeBlinkLeft', 'eyeBlinkRight'].forEach(name => {
            const idx = mesh.morphTargetDictionary![name];
            if (idx !== undefined) {
              const curBlink = mesh.morphTargetInfluences![idx];
              mesh.morphTargetInfluences![idx] = curBlink + (blink - curBlink) * 0.4;
            }
          });
        }
      }
    });

    if (bones.leftBreast) bones.leftBreast.scale.set(1.4, 1.4, 1.4);
    if (bones.rightBreast) bones.rightBreast.scale.set(1.4, 1.4, 1.4);
    if (group.current) group.current.position.y = Math.sin(t * 1.2) * 0.01 - 1.6;
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};

useGLTF.preload('https://storage.googleapis.com/ai-studio-bucket-696108077748-us-west1/services/receptionist-ai/public/animations/avatar.glb');
useFBX.preload(ANIMATION_URLS.talking);
useFBX.preload(ANIMATION_URLS.rumba);
useFBX.preload(ANIMATION_URLS.idle);
