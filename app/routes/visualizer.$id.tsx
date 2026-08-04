import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useNavigate, useOutletContext, useParams} from "react-router";
import {generate3DView} from "../../lib/ai.action";
import {Box, Download, RefreshCcw, Share, Share2, X} from "lucide-react";
import Button from "../../Components/ui/Button";
import type {AuthContext, DesignItem} from "../../type";
import {createProject, getProjectById} from "../../lib/puter.action";

const VisualizerId = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userId } = useOutletContext<AuthContext>()

    const hasInitialGenerated = useRef(false);

    const [project, setProject] = useState<DesignItem | null>(null);
    const [isProjectLoading, setIsProjectLoading] = useState(true);

    const [isProcessing, setIsProcessing] = useState(false);
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleBack = () => navigate('/');

    const runGeneration = async (item: DesignItem) => {
        if (!id || !item.sourceImage) return;

        try {
            setIsProcessing(true);
            setError(null);
            const result = await generate3DView({sourceImage: item.sourceImage});

            if (result.renderedImage) {
                setCurrentImage(result.renderedImage);

                const updatedItem = {
                    ... item,
                    renderedImage: result.renderedImage,
                    renderedPath: result.renderedPath,
                    timestamp: Date.now(),
                    ownerId: item.ownerId ?? userId ?? null,
                    isPublic: item.isPublic ?? false,
                }

                const saved = await createProject({item: updatedItem, visibility: "private"});

                if (saved) {
                    setProject(saved);
                    setCurrentImage(saved.renderedImage || result.renderedImage);
                }
                hasInitialGenerated.current = true;
            } else {
                setError('Failed to generate image');
            }
        } catch (err: any) {
            console.error('Generation failed', err);
            setError(err.message || 'Generation failed');
        } finally {
            setIsProcessing(false);
        }
    }

    useEffect(() => {
        let isMounted = true;

        const loadProject = async () => {
            if (!id) {
                setIsProjectLoading(false);
                return;
            }

            setIsProjectLoading(true);

            try {
                const fetchedProject = await getProjectById({ id });

                if (!isMounted) return;

                setProject(fetchedProject);
                setCurrentImage(fetchedProject?.renderedImage || null);
            } catch (error) {
                console.error("Failed to load project:", error);
            } finally {
                if (isMounted) {
                    setIsProjectLoading(false);
                    hasInitialGenerated.current = false;
                }
            }
        };

        loadProject();

        return () => {
            isMounted = false;
        };
    }, [id]);

    useEffect(() => {
        if (
            isProjectLoading ||
            hasInitialGenerated.current ||
            !project?.sourceImage ||
            error
        )
            return;

        if (project.renderedImage) {
            setCurrentImage(project.renderedImage);
            hasInitialGenerated.current = true;
            return;
        }

        void runGeneration(project);
    }, [project, isProjectLoading, error]);

    return (
        <div className="visualizer">
            <nav className="topbar">
                <div className="brand">
                    <Box className="logo"></Box>

                    <span className="name">Roomify</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
                    <X className="icon" /> Exit Editor
                </Button>
            </nav>

            <section className="content">
                <div className="panel">
                    <div className="panel-header">
                        <div className="panel-meta">
                            <p>Project</p>
                            <h2>{project?.name || `Residence ${id}`}</h2>
                            <p className="note">Created by You</p>
                        </div>

                        <div className="panel-actions">
                            <Button
                                size="sm"
                                onClick={() => {}}
                                className="export"
                                disabled={!currentImage}
                            >
                                <Download className="w-4 h-4 mr-2" /> Export
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {}}
                                className="share"
                            >
                                <Share2 className="w-4 h-4 mr-2" /> Share
                            </Button>
                        </div>
                    </div>
                    <div className={`render-area ${isProcessing ? 'is-processing': ''}`}>
                        {currentImage ? (
                            <img src={currentImage} alt="AI Render" className="render-img" />
                        ) : (
                            <div className="render-placeholder">
                                {project?.sourceImage && (
                                    <img src={project?.sourceImage} alt="Original" className="render-fallback" />
                                )}

                                {isProcessing && (
                                    <div className="render-area">
                                        <div className="rendering-card">
                                            <RefreshCcw className="spinner" />
                                            <span className="title">Rendering...</span>
                                            <span className="title">Generating your 3D visualization...</span>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="render-area">
                                        <div className="rendering-card error">
                                            <span className="title text-red-500">Generation Failed</span>
                                            <span className="text-sm mb-4">{error}</span>
                                            <Button
                                                onClick={() => project && runGeneration(project)}
                                                className="retry-button"
                                            >
                                                <RefreshCcw className="w-4 h-4 mr-2" /> Retry
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                        }
                    </div>
                </div>
            </section>

        </div>
    );
};

export default VisualizerId;