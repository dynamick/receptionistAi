
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Float } from '@react-three/drei';
import { Avatar } from './Avatar';

interface SceneProps {
  isSpeaking: boolean;
  audioAmplitude: number;
}

const Scene: React.FC<SceneProps> = ({ isSpeaking, audioAmplitude }) => {
  return (
    <Canvas
      // Adjusted position from [0, 0, 2.5] to [0, 0.1, 1.2] to bring the camera closer 
      // and slightly higher for a "mezzo busto" framing.
      camera={{ position: [0, 0.1, 1.2], fov: 45 }}
      className="w-full h-full"
      shadows
    >
      <color attach="background" args={['#0f172a']} />
      
      <Suspense fallback={null}>
        <Environment preset="city" />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
          <Avatar 
            modelUrl="avatar.glb" 
            isSpeaking={isSpeaking}
            audioAmplitude={audioAmplitude}
          />
        </Float>

        <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} resolution={256} color="#000000" />
      </Suspense>

      <OrbitControls 
        enablePan={false}
        // Updated target to look slightly higher (at the face/chest area)
        target={[0, 0.1, 0]}
        minDistance={0.8}
        maxDistance={2.5}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
        enableDamping
      />
    </Canvas>
  );
};

export default Scene;
