/**
 * Future preview simulator.
 *
 * Thin delegator — future simulation IS current resolution with a future `at`.
 * No simulation fork. PRE.resolve() is the simulation engine.
 *
 * Constitutional guarantee: previewFuture and previewCurrent use the SAME
 * resolve() call path. The "future" is encoded entirely in request.at.
 */

export { previewCurrent as previewFuture } from '../preview-endpoint';
