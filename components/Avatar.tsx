
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import { useGLTF, useAnimations, useFBX } from '@react-three/drei';
import { AVATARS, ANIMATION_URLS } from '../constants';
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
  isJumpCommanded: boolean;
  isAngryCommanded: boolean;
  isGreetingCommanded: boolean;
  isHipHopCommanded: boolean;
  isKissCommanded: boolean;
  isLookAroundCommanded: boolean;
  isPointingCommanded: boolean;
  audioAmplitude: number;
}

export const Avatar: React.FC<AvatarProps> = ({ 
  modelUrl, 
  isSpeaking, 
  isRumbaCommanded, 
  isJumpCommanded, 
  isAngryCommanded,
  isGreetingCommanded,
  isHipHopCommanded,
  isKissCommanded,
  isLookAroundCommanded,
  isPointingCommanded,
  audioAmplitude 
}) => {
  const group = useRef<THREE.Group>(null);
  const [isAutoLooking, setIsAutoLooking] = useState(false);
  
  // Load the GLTF model
  const { scene, animations: gltfAnimations } = useGLTF(modelUrl);
  
  // Enable shadows for the model
  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [scene]);
  
  // Load FBX animations
  const talkFbx = useFBX(ANIMATION_URLS.talking);
  const idleRumbaFbx = useFBX(ANIMATION_URLS.rumba);
  const idleStandingFbx = useFBX(ANIMATION_URLS.idle);
  const jumpFbx = useFBX(ANIMATION_URLS.jump);
  const angryFbx = useFBX(ANIMATION_URLS.angry);
  const greetingFbx = useFBX(ANIMATION_URLS.greeting);
  const hipHopFbx = useFBX(ANIMATION_URLS.hipHop);
  const kissFbx = useFBX(ANIMATION_URLS.kiss);
  const lookAroundFbx = useFBX(ANIMATION_URLS.lookAround);
  const pointingFbx = useFBX(ANIMATION_URLS.pointing);

  const allAnimations = useMemo(() => {
    const clips: THREE.AnimationClip[] = [...gltfAnimations];
    
    const processFbx = (fbx: THREE.Group, prefix: string) => {
      if (!fbx || !fbx.animations) return;
      fbx.animations.forEach((clip, index) => {
        const newClip = clip.clone();
        newClip.name = `${prefix}_${index}`;
        // Clean up track names for Mixamo/Ready Player Me compatibility
        newClip.tracks.forEach((track) => {
          track.name = track.name.replace(/^(?:.*[:_])?(mixamorig|MixamoRig|Armature)[:_]*/i, '');
        });
        clips.push(newClip);
      });
    };
    
    processFbx(idleRumbaFbx, 'fbx_idle_rumba');
    processFbx(idleStandingFbx, 'fbx_idle_standing');
    processFbx(talkFbx, 'fbx_talk');
    processFbx(jumpFbx, 'fbx_jump');
    processFbx(angryFbx, 'fbx_angry');
    processFbx(greetingFbx, 'fbx_greeting');
    processFbx(hipHopFbx, 'fbx_hip_hop');
    processFbx(kissFbx, 'fbx_kiss');
    processFbx(lookAroundFbx, 'fbx_look_around');
    processFbx(pointingFbx, 'fbx_pointing');
    
    return clips;
  }, [gltfAnimations, idleRumbaFbx, idleStandingFbx, talkFbx, jumpFbx, angryFbx, greetingFbx, hipHopFbx, kissFbx, lookAroundFbx, pointingFbx]);

  const { actions } = useAnimations(allAnimations, group);
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  // Dynamic Idle Logic: Periodically trigger lookAround when otherwise idle
  useEffect(() => {
    // If any explicit state or speaking is active, disable auto-idle actions
    if (isSpeaking || isJumpCommanded || isAngryCommanded || isGreetingCommanded || 
        isHipHopCommanded || isKissCommanded || isLookAroundCommanded || 
        isPointingCommanded || isRumbaCommanded) {
      setIsAutoLooking(false);
      return;
    }

    const trigger = () => {
      setIsAutoLooking(true);
      // Look around for 4.5 seconds (duration of the clip roughly)
      setTimeout(() => setIsAutoLooking(false), 4500);
    };

    // Trigger every 12 seconds when idle
    const interval = setInterval(trigger, 12000);
    return () => clearInterval(interval);
  }, [isSpeaking, isJumpCommanded, isAngryCommanded, isGreetingCommanded, 
      isHipHopCommanded, isKissCommanded, isLookAroundCommanded, 
      isPointingCommanded, isRumbaCommanded]);

  useEffect(() => {
    if (!actions) return;
    const names = Object.keys(actions);
    
    const findAnim = (pattern: string) => names.find(n => n.includes(pattern));

    const talkName = findAnim('fbx_talk');
    const idleStandingName = findAnim('fbx_idle_standing');
    const idleRumbaName = findAnim('fbx_idle_rumba');
    const jumpName = findAnim('fbx_jump');
    const angryName = findAnim('fbx_angry');
    const greetingName = findAnim('fbx_greeting');
    const hipHopName = findAnim('fbx_hip_hop');
    const kissName = findAnim('fbx_kiss');
    const lookAroundName = findAnim('fbx_look_around');
    const pointingName = findAnim('fbx_pointing');
    
    let nextAction = null;
    
    // Priority Chain
    if (isJumpCommanded) nextAction = jumpName;
    else if (isAngryCommanded) nextAction = angryName;
    else if (isGreetingCommanded) nextAction = greetingName;
    else if (isHipHopCommanded) nextAction = hipHopName;
    else if (isKissCommanded) nextAction = kissName;
    else if (isLookAroundCommanded) nextAction = lookAroundName;
    else if (isPointingCommanded) nextAction = pointingName;
    else if (isRumbaCommanded) nextAction = idleRumbaName;
    else if (isSpeaking) nextAction = talkName;
    // The "Loopable Idle" (periodic look around) plays BEFORE the default standing idle
    else if (isAutoLooking) nextAction = lookAroundName;
    else nextAction = idleStandingName;

    if (!nextAction) nextAction = names[0];

    if (nextAction && nextAction !== currentAction) {
      const prev = currentAction ? actions[currentAction] : null;
      const next = actions[nextAction];
      if (next) {
        if (prev) prev.fadeOut(0.3);
        next.reset().fadeIn(0.3).play();
        setCurrentAction(nextAction);
      }
    }
  }, [
    isSpeaking, isRumbaCommanded, isJumpCommanded, 
    isAngryCommanded, isGreetingCommanded, isHipHopCommanded, 
    isKissCommanded, isLookAroundCommanded, isPointingCommanded,
    isAutoLooking, actions, currentAction
  ]);

  useFrame((state) => {
    if (!scene) return;
    const t = state.clock.getElapsedTime();
    
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          // Lip sync
          const mouthOpenIdx = 
            mesh.morphTargetDictionary['mouthOpen'] ?? 
            mesh.morphTargetDictionary['jawOpen'] ?? 
            mesh.morphTargetDictionary['viseme_aa'] ?? 
            mesh.morphTargetDictionary['vrc.v_aa'] ??
            mesh.morphTargetDictionary['MouthOpen'];

          if (mouthOpenIdx !== undefined) {
            const target = isSpeaking ? audioAmplitude * 1.2 : 0;
            const current = mesh.morphTargetInfluences[mouthOpenIdx];
            const desired = Math.min(target, 0.6);
            mesh.morphTargetInfluences[mouthOpenIdx] = current + (desired - current) * 0.25;
          }

          // Blinking
          const blink = Math.sin(t * 3.8) > 0.98 ? 1 : 0;
          const blinkLeftIdx = mesh.morphTargetDictionary['eyeBlinkLeft'] ?? mesh.morphTargetDictionary['Blink_Left'];
          const blinkRightIdx = mesh.morphTargetDictionary['eyeBlinkRight'] ?? mesh.morphTargetDictionary['Blink_Right'];

          if (blinkLeftIdx !== undefined) {
            mesh.morphTargetInfluences[blinkLeftIdx] = mesh.morphTargetInfluences[blinkLeftIdx] + (blink - mesh.morphTargetInfluences[blinkLeftIdx]) * 0.4;
          }
          if (blinkRightIdx !== undefined) {
            mesh.morphTargetInfluences[blinkRightIdx] = mesh.morphTargetInfluences[blinkRightIdx] + (blink - mesh.morphTargetInfluences[blinkRightIdx]) * 0.4;
          }
        }
      }
    });
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};

// Preload assets
useGLTF.preload(AVATARS.kai);
useGLTF.preload(AVATARS.mick);
[
  ANIMATION_URLS.talking, ANIMATION_URLS.rumba, ANIMATION_URLS.idle, 
  ANIMATION_URLS.jump, ANIMATION_URLS.angry, ANIMATION_URLS.greeting,
  ANIMATION_URLS.hipHop, ANIMATION_URLS.kiss, ANIMATION_URLS.lookAround,
  ANIMATION_URLS.pointing
].forEach(url => useFBX.preload(url));
